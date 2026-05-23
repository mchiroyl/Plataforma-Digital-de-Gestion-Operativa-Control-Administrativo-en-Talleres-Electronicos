import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Client, LocalAuth } from 'whatsapp-web.js';
import QRCode from 'qrcode';
import * as qrcode from 'qrcode-terminal';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CoreService } from '../../core/application/core.service';
import { PrismaService } from '../../../shared/infrastructure/persistence/prisma/prisma.service';
import {
  WHATSAPP_CHANNEL_KEY,
  WHATSAPP_CHANNEL_LABEL,
  WHATSAPP_CLIENT_ID,
  WHATSAPP_PROTOCOL_TIMEOUT_MS,
  WHATSAPP_START_RETRIES,
  WHATSAPP_START_RETRY_DELAY_MS,
  WHATSAPP_STARTUP_TIMEOUT_MS,
  WHATSAPP_HEADLESS,
  WHATSAPP_WEB_CACHE,
  WHATSAPP_WEB_VERSION,
} from '../infrastructure/whatsapp-options';

@Injectable()
export class WhatsappService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsappService.name);
  private client?: Client;
  private ready = false;
  private authenticated = false;
  private lastQr?: string;
  private lastQrImageDataUrl?: string;
  // The client library is patched postinstall to retry transient navigation races during startup.
  private lastError?: string;
  private initializing = false;
  private restoreFailed = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly core: CoreService,
  ) {}

  onModuleInit() {
    if (!this.hasStoredAuthSession()) return;

    this.logger.log('Se detecto una sesion previa de WhatsApp. Intentando restaurarla automaticamente...');
    this.lastError = undefined;
    this.restoreFailed = false;
    this.initializing = true;
    void this.initializeClient(1, 'restore');
  }

  async onModuleDestroy() {
    const activeClient = this.client;
    this.client = undefined;
    this.initializing = false;
    this.ready = false;
    this.authenticated = false;
    this.lastQr = undefined;
    this.lastQrImageDataUrl = undefined;

    if (activeClient) {
      await activeClient.destroy().catch(() => undefined);
    }

    this.terminateSessionBrowserProcesses();
  }

  start() {
    if (this.client || this.initializing) return { status: this.ready ? 'READY' : 'STARTING', message: 'Cliente WhatsApp ya iniciado' };

    this.lastError = undefined;
    if (this.restoreFailed) {
      this.purgeAuthSession();
      this.restoreFailed = false;
    }
    this.initializing = true;
    void this.initializeClient(1, 'fresh');
    return { status: 'STARTING', message: 'Vinculacion por QR iniciada' };
  }

  async status() {
    await this.refreshSessionHealth();
    return {
      started: Boolean(this.client) || this.authenticated,
      initializing: this.initializing,
      ready: this.ready || this.authenticated,
      hasQr: Boolean(this.lastQr) && !this.authenticated,
      qrCodeDataUrl: this.lastQrImageDataUrl,
      lastError: this.lastError,
      channelKey: WHATSAPP_CHANNEL_KEY,
      channelLabel: WHATSAPP_CHANNEL_LABEL,
    };
  }

  async stop() {
    const activeClient = this.client;
    this.client = undefined;
    this.initializing = false;
    this.ready = false;
    this.authenticated = false;
    this.lastQr = undefined;
    this.lastQrImageDataUrl = undefined;
    this.lastError = undefined;

    if (activeClient) {
      await activeClient.logout().catch(() => undefined);
      await activeClient.destroy().catch(() => undefined);
    }

    this.terminateSessionBrowserProcesses();
    const authPath = this.resolveAuthPath();
    fs.rmSync(authPath, { recursive: true, force: true });
    this.logger.warn(`Sesion de WhatsApp desvinculada. Se limpio ${authPath}`);
    return { status: 'STOPPED', message: 'Numero desvinculado correctamente' };
  }

  private async refreshSessionHealth() {
    if (!this.client) return;
    if (this.initializing) return;

    try {
      const state = await this.client.getState();
      const normalizedState = String(state ?? '').toUpperCase();

      if (normalizedState === 'CONNECTED') {
        this.ready = true;
        this.authenticated = true;
        return;
      }

      if (['OPENING', 'PAIRING'].includes(normalizedState)) {
        this.initializing = true;
        this.ready = false;
        this.authenticated = false;
        return;
      }

      if (['UNPAIRED', 'UNPAIRED_IDLE', 'TIMEOUT', 'CONFLICT', 'PROXYBLOCK', 'TOS_BLOCK'].includes(normalizedState)) {
        await this.resetRuntimeSession(`La sesion de WhatsApp ya no esta vinculada (${normalizedState}).`);
      }
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      if (
        detail.includes("Cannot read properties of null (reading 'evaluate')") ||
        detail.includes('Attempted to use detached Frame')
      ) {
        this.logger.debug('La sesion de WhatsApp aun no expone un estado verificable; se mantiene el arranque en curso.');
        return;
      }
      await this.resetRuntimeSession(`No se pudo verificar la sesion actual de WhatsApp: ${detail}`);
    }
  }

  recentMessages() {
    return this.prisma.whatsappNotification.findMany({
      orderBy: { sentAt: 'desc' },
      take: 100,
      select: {
        id: true,
        orderId: true,
        destinationPhone: true,
        template: true,
        deliveryStatus: true,
        message: true,
        sentAt: true,
        apiResponse: true,
        order: {
          select: {
            id: true,
            orderCode: true,
            status: true,
            trackingToken: true,
            client: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true,
              },
            },
          },
        },
      },
    });
  }

  async send(orderId: number | undefined, destinationPhone: string, message: string, sentById?: number) {
    if (!this.client || !this.ready) {
      return this.log(orderId, destinationPhone, 'manual_message', 'PENDING', message, sentById, {
        channelKey: WHATSAPP_CHANNEL_KEY,
        channelLabel: WHATSAPP_CHANNEL_LABEL,
        reason: 'WhatsApp no esta conectado',
      });
    }

    const chatId = this.normalize(destinationPhone);
    try {
      const result = await this.client.sendMessage(chatId, message);
      return this.log(orderId, destinationPhone, 'manual_message', 'SENT', message, sentById, {
        channelKey: WHATSAPP_CHANNEL_KEY,
        channelLabel: WHATSAPP_CHANNEL_LABEL,
        direction: 'OUTBOUND',
        id: result.id.id,
      });
    } catch (error) {
      return this.log(orderId, destinationPhone, 'manual_message', 'FAILED', message, sentById, {
        channelKey: WHATSAPP_CHANNEL_KEY,
        channelLabel: WHATSAPP_CHANNEL_LABEL,
        direction: 'OUTBOUND',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private normalize(phone: string) {
    const digits = phone.replace(/\D/g, '');
    const withCountry = digits.length === 8 ? `502${digits}` : digits;
    return `${withCountry}@c.us`;
  }

  private resolveBrowserCandidates() {
    const candidates = [
      process.env.CHROME_EXECUTABLE_PATH,
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/usr/bin/google-chrome',
    ].filter(Boolean) as string[];

    return [...new Set(candidates.filter((candidate) => fs.existsSync(candidate)))];
  }

  private async initializeClient(attempt = 1, mode: 'restore' | 'fresh' = 'fresh'): Promise<void> {
    const browserCandidates = this.resolveBrowserCandidates();
    let lastFailure = 'No se encontro un navegador compatible para iniciar WhatsApp.';
    let sessionPurgedForRecovery = false;
    const restoringStoredSession = mode === 'restore' && this.hasStoredAuthSession();
    const startupTimeoutMs = restoringStoredSession ? Math.max(WHATSAPP_STARTUP_TIMEOUT_MS, 180000) : WHATSAPP_STARTUP_TIMEOUT_MS;
    const candidatesToTry = restoringStoredSession ? browserCandidates.slice(0, 1) : browserCandidates;
    this.terminateSessionBrowserProcesses();
    if (restoringStoredSession) {
      this.cleanupAuthRuntimeArtifacts('minimal');
    } else {
      this.cleanupAuthRuntimeArtifacts('aggressive');
    }

    for (const browserPath of candidatesToTry) {
      this.logger.log(
        `Iniciando WhatsApp (intento ${attempt}/${WHATSAPP_START_RETRIES}) con navegador ${browserPath}, headless=${WHATSAPP_HEADLESS}, protocolTimeout=${WHATSAPP_PROTOCOL_TIMEOUT_MS}ms y startupTimeout=${startupTimeoutMs}ms`,
      );

      const clientOptions: ConstructorParameters<typeof Client>[0] = {
        authStrategy: new LocalAuth({ clientId: WHATSAPP_CLIENT_ID }),
        puppeteer: {
          headless: WHATSAPP_HEADLESS,
          protocolTimeout: WHATSAPP_PROTOCOL_TIMEOUT_MS,
          executablePath: browserPath,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        },
        takeoverOnConflict: true,
        takeoverTimeoutMs: 0,
        qrMaxRetries: 0,
      };

      if (WHATSAPP_WEB_VERSION) {
        clientOptions.webVersion = WHATSAPP_WEB_VERSION;
        clientOptions.webVersionCache = WHATSAPP_WEB_CACHE;
      }

      const client = new Client(clientOptions);
      this.client = client;

      client.on('qr', (qr) => {
        this.lastQr = qr;
        this.ready = false;
        this.authenticated = false;
        this.initializing = false;
        this.lastError = undefined;
        void QRCode.toDataURL(qr, { margin: 1, width: 320 })
          .then((value) => {
            this.lastQrImageDataUrl = value;
          })
          .catch(() => {
            this.lastQrImageDataUrl = undefined;
          });
        this.logger.log('Escanee el QR desde WhatsApp > Dispositivos vinculados.');
        qrcode.generate(qr, { small: true });
      });

      client.on('authenticated', () => {
        this.authenticated = true;
        this.initializing = false;
        this.lastQr = undefined;
        this.lastQrImageDataUrl = undefined;
        this.lastError = undefined;
        this.logger.log('Sesion de WhatsApp autenticada. Finalizando sincronizacion...');
      });

      client.on('ready', () => {
        this.ready = true;
        this.authenticated = true;
        this.initializing = false;
        this.lastQr = undefined;
        this.lastQrImageDataUrl = undefined;
        this.logger.log('WhatsApp conectado como dispositivo secundario.');
      });

      client.on('message', (message) => {
        if (message.fromMe || !message.from.endsWith('@c.us')) return;
        const rawMessage = message as typeof message & { _data?: { notifyName?: string } };
        const sourcePhone = message.from.replace('@c.us', '');

        void this.log(undefined, message.from.replace('@c.us', ''), 'incoming_message', 'RECEIVED', message.body, undefined, {
          channelKey: WHATSAPP_CHANNEL_KEY,
          channelLabel: WHATSAPP_CHANNEL_LABEL,
          direction: 'INBOUND',
          from: message.from,
          messageId: message.id.id,
          pushName: rawMessage._data?.notifyName ?? null,
          timestamp: message.timestamp,
        }).catch((error: unknown) => {
          const detail = error instanceof Error ? error.message : String(error);
          this.logger.warn(`No se pudo registrar mensaje entrante: ${detail}`);
        });

        void this.tryAutoQuoteDecision(sourcePhone, message.body, rawMessage._data?.notifyName ?? undefined).catch((error: unknown) => {
          const detail = error instanceof Error ? error.message : String(error);
          this.logger.warn(`No se pudo procesar decision automatica por WhatsApp: ${detail}`);
        });

        void this.tryReplyToAmbiguousQuoteDecision(sourcePhone, message.body).catch((error: unknown) => {
          const detail = error instanceof Error ? error.message : String(error);
          this.logger.warn(`No se pudo responder decision ambigua por WhatsApp: ${detail}`);
        });
      });

      client.on('disconnected', (reason) => {
        this.ready = false;
        this.authenticated = false;
        this.initializing = false;
        this.lastQr = undefined;
        this.lastQrImageDataUrl = undefined;
        this.logger.warn(`WhatsApp desconectado: ${reason}`);
        if (this.client === client) this.client = undefined;
      });

      try {
        await Promise.race([
          client.initialize(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Tiempo de espera agotado al iniciar WhatsApp con ${browserPath}`)), startupTimeoutMs),
          ),
        ]);
        return;
      } catch (error: unknown) {
        const detail = error instanceof Error ? error.message : String(error);
        lastFailure = detail;
        this.ready = false;
        this.authenticated = false;
        this.initializing = false;
        this.lastQr = undefined;
        this.lastQrImageDataUrl = undefined;
        this.lastError = detail;
        await client.destroy().catch(() => undefined);
        if (this.client === client) this.client = undefined;
        this.terminateSessionBrowserProcesses();
        await this.pause(800);
        if (restoringStoredSession) {
          this.cleanupAuthRuntimeArtifacts('minimal');
        } else {
          this.cleanupAuthRuntimeArtifacts('aggressive');
        }
        this.logger.error(`No se pudo iniciar WhatsApp con ${browserPath}: ${detail}`);

        if (!restoringStoredSession && !sessionPurgedForRecovery && this.shouldRecreateAuthSession(detail)) {
          sessionPurgedForRecovery = true;
          this.purgeAuthSession();
          break;
        }
      }
    }

    if (restoringStoredSession) {
      this.initializing = false;
      this.client = undefined;
      this.restoreFailed = true;
      this.lastError =
        'No se pudo restaurar automaticamente la sesion activa de WhatsApp. Si el telefono aun aparece vinculado, espere un momento y vuelva a intentar; de lo contrario, use Desvincular e Iniciar QR.';
      this.logger.warn(this.lastError);
      return;
    }

    if (sessionPurgedForRecovery && attempt < WHATSAPP_START_RETRIES) {
      this.initializing = true;
      this.logger.warn(`Se limpio la sesion local de WhatsApp para recuperacion. Reintentando en ${WHATSAPP_START_RETRY_DELAY_MS}ms...`);
      await this.pause(WHATSAPP_START_RETRY_DELAY_MS);
      return this.initializeClient(attempt + 1, mode);
    }

    if (attempt < WHATSAPP_START_RETRIES && this.isTransientStartupError(lastFailure)) {
      this.initializing = true;
      this.logger.warn(`Reintentando inicio de WhatsApp en ${WHATSAPP_START_RETRY_DELAY_MS}ms...`);
      await this.pause(WHATSAPP_START_RETRY_DELAY_MS);
      return this.initializeClient(attempt + 1, mode);
    }
  }

  private isTransientStartupError(message: string) {
    return (
      message.includes('Runtime.callFunctionOn timed out') ||
      message.includes('Tiempo de espera agotado') ||
      message.includes('Execution context was destroyed') ||
      message.includes('most likely because of a navigation') ||
      message.includes('Cannot find context with specified id') ||
      message.includes('The browser is already running for')
    );
  }

  private shouldRecreateAuthSession(message: string) {
    return (
      message.includes('The browser is already running for') ||
      message.includes('Failed to launch the browser process') ||
      message.includes('downgrade_utils.cc') ||
      message.includes('Settings version is not 1') ||
      message.includes('Acceso denegado')
    );
  }

  private log(orderId: number | undefined, destinationPhone: string, template: string, deliveryStatus: string, message: string, sentById: number | undefined, apiResponse: Record<string, unknown>) {
    return this.prisma.whatsappNotification.create({
      data: {
        orderId,
        destinationPhone,
        template,
        deliveryStatus,
        message,
        sentById,
        apiResponse: apiResponse as Prisma.InputJsonObject,
      },
    });
  }

  private async tryAutoQuoteDecision(sourcePhone: string, body: string, customerName?: string) {
    const decision = this.extractQuoteDecision(body);
    if (!decision) return;

    await this.core.customerQuoteDecisionFromWhatsapp(
      decision.orderCode,
      decision.approved,
      sourcePhone,
      customerName,
      body,
    );

    this.logger.log(
      `Decision automatica registrada por WhatsApp para ${decision.orderCode}: ${decision.approved ? 'ACEPTADA' : 'RECHAZADA'}`,
    );
  }

  private async tryReplyToAmbiguousQuoteDecision(sourcePhone: string, body: string) {
    if (this.extractQuoteDecision(body)) return;
    const normalized = body
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase();

    const isAmbiguousDecision =
      /\bSI\s+ACEPTO\b/.test(normalized) ||
      /\bNO\s+ACEPTO\b/.test(normalized);

    if (!isAmbiguousDecision || !this.client || !this.ready) return;

    const pendingOrders = await this.core.findPendingQuoteOrdersByPhone(sourcePhone);
    const example = pendingOrders.length
      ? pendingOrders
          .slice(0, 5)
          .map((order) => `- ${order.orderCode}`)
          .join('\n')
      : '- ORD-2026-00003';

    const reply = pendingOrders.length
      ? `Para registrar su respuesta necesitamos que indique el numero de orden.\n\nResponda con una de estas opciones:\n✅ SI ACEPTO ORD-AAAA-00000\n❌ NO ACEPTO ORD-AAAA-00000\n\nOrdenes pendientes asociadas a este numero:\n${example}`
      : `Para registrar su respuesta necesitamos que indique el numero de orden.\n\nResponda con una de estas opciones:\n✅ SI ACEPTO ORD-AAAA-00000\n❌ NO ACEPTO ORD-AAAA-00000`;

    const result = await this.client.sendMessage(this.normalize(sourcePhone), reply);
    await this.log(undefined, sourcePhone, 'auto_reply_missing_order_code', 'SENT', reply, undefined, {
      channelKey: WHATSAPP_CHANNEL_KEY,
      channelLabel: WHATSAPP_CHANNEL_LABEL,
      direction: 'OUTBOUND',
      id: result.id.id,
      reason: 'missing_order_code',
    });
  }

  private extractQuoteDecision(body: string) {
    const normalized = body
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase();

    const acceptMatch = normalized.match(/\bSI\s+ACEPTO\s+(ORD-\d{4}-\d{5})\b/);
    if (acceptMatch) {
      return { approved: true, orderCode: acceptMatch[1] };
    }

    const rejectMatch = normalized.match(/\bNO\s+ACEPTO\s+(ORD-\d{4}-\d{5})\b/);
    if (rejectMatch) {
      return { approved: false, orderCode: rejectMatch[1] };
    }

    return null;
  }

  private resolveAuthPath() {
    return path.resolve(process.cwd(), '.wwebjs_auth', `session-${WHATSAPP_CLIENT_ID}`);
  }

  private hasStoredAuthSession() {
    const authPath = this.resolveAuthPath();
    return fs.existsSync(authPath) && fs.readdirSync(authPath).length > 0;
  }

  private cleanupAuthRuntimeArtifacts(mode: 'minimal' | 'aggressive' = 'aggressive') {
    const authPath = this.resolveAuthPath();
    const candidates = ['SingletonLock', 'SingletonCookie', 'SingletonSocket', 'DevToolsActivePort', 'Last Browser', 'lockfile'].map(
      (name) => path.join(authPath, name),
    );
    const volatileDirectories = [
      'Crashpad',
      'ShaderCache',
      'GrShaderCache',
      'GraphiteDawnCache',
      'DawnGraphiteCache',
      'DawnWebGPUCache',
      'component_crx_cache',
      'Snapshots',
    ].map((name) => path.join(authPath, name));
    const volatileFiles = ['BrowserMetrics-spare.pma', 'first_party_sets.db', 'first_party_sets.db-journal'].map((name) =>
      path.join(authPath, name),
    );

    for (const filePath of candidates) {
      try {
        if (fs.existsSync(filePath)) {
          fs.rmSync(filePath, { force: true });
        }
      } catch (error: unknown) {
        const detail = error instanceof Error ? error.message : String(error);
        this.logger.warn(`No se pudo limpiar el lock ${filePath}: ${detail}`);
      }
    }

    if (mode === 'aggressive') {
      for (const dirPath of volatileDirectories) {
        try {
          if (fs.existsSync(dirPath)) {
            fs.rmSync(dirPath, { recursive: true, force: true });
          }
        } catch (error: unknown) {
          const detail = error instanceof Error ? error.message : String(error);
          this.logger.warn(`No se pudo limpiar cache temporal de Chromium ${dirPath}: ${detail}`);
        }
      }
    }

    if (mode === 'aggressive') {
      for (const filePath of volatileFiles) {
        try {
          if (fs.existsSync(filePath)) {
            fs.rmSync(filePath, { force: true });
          }
        } catch (error: unknown) {
          const detail = error instanceof Error ? error.message : String(error);
          this.logger.warn(`No se pudo limpiar archivo temporal de Chromium ${filePath}: ${detail}`);
        }
      }
    }

    if (mode !== 'aggressive') return;

    try {
      if (!fs.existsSync(authPath)) return;

      for (const entry of fs.readdirSync(authPath, { withFileTypes: true })) {
        if (!entry.isDirectory() || !entry.name.endsWith('.CHROME_DELETE')) continue;
        fs.rmSync(path.join(authPath, entry.name), { recursive: true, force: true });
      }
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.warn(`No se pudieron limpiar directorios temporales de Chromium en ${authPath}: ${detail}`);
    }
  }

  private purgeAuthSession() {
    const authPath = this.resolveAuthPath();
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        this.terminateSessionBrowserProcesses();
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 600);
        this.cleanupAuthRuntimeArtifacts();
        fs.rmSync(authPath, { recursive: true, force: true });
        this.logger.warn(`Se elimino la sesion local de WhatsApp para iniciar una vinculacion limpia: ${authPath}`);
        return;
      } catch (error: unknown) {
        const detail = error instanceof Error ? error.message : String(error);
        if (attempt === 3) {
          this.logger.warn(`No se pudo eliminar la sesion local de WhatsApp en ${authPath}: ${detail}`);
        }
      }
    }
  }

  private pause(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private terminateSessionBrowserProcesses() {
    const authPath = this.resolveAuthPath();
    const escapedAuthPath = authPath.replace(/'/g, "''");

    try {
      if (process.platform === 'win32') {
        const script = [
          `$profilePath = '${escapedAuthPath}';`,
          `$profilePattern = [regex]::Escape($profilePath);`,
          `$procs = @(Get-CimInstance Win32_Process -Filter "name = 'chrome.exe' or name = 'msedge.exe'" |`,
          `Where-Object { $_.CommandLine -and $_.CommandLine -match $profilePattern });`,
          `foreach ($proc in $procs) {`,
          `  taskkill.exe /PID $proc.ProcessId /T /F | Out-Null;`,
          `}`,
          `Write-Output ("killed:" + $procs.Count);`,
        ].join(' ');

        const output = execFileSync(
          'powershell.exe',
          ['-NoProfile', '-NonInteractive', '-Command', script],
          { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
        )
          .toString()
          .trim();

        if (output && output !== 'killed:0') {
          this.logger.log(`Se cerraron procesos del navegador para liberar la sesion de WhatsApp: ${output}`);
        }
      }
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.warn(`No se pudieron cerrar procesos del navegador para la sesion de WhatsApp: ${detail}`);
    }
  }

  private async resetRuntimeSession(reason: string) {
    const activeClient = this.client;
    this.client = undefined;
    this.initializing = false;
    this.ready = false;
    this.authenticated = false;
    this.lastQr = undefined;
    this.lastQrImageDataUrl = undefined;
    this.lastError = reason;

    if (activeClient) {
      await activeClient.destroy().catch(() => undefined);
    }

    this.logger.warn(reason);
  }
}


