import { BadRequestException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Client, LocalAuth, type Message } from 'whatsapp-web.js';
import QRCode from 'qrcode';
import * as qrcode from 'qrcode-terminal';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CoreService } from '../../core/application/core.service';
import { PrismaService } from '../../../shared/infrastructure/persistence/prisma/prisma.service';
import {
  DEFAULT_WHATSAPP_CHANNEL_KEY,
  WHATSAPP_CHANNELS,
  WHATSAPP_HEADLESS,
  WHATSAPP_PROTOCOL_TIMEOUT_MS,
  WHATSAPP_START_RETRIES,
  WHATSAPP_START_RETRY_DELAY_MS,
  WHATSAPP_STARTUP_TIMEOUT_MS,
  WHATSAPP_WEB_CACHE,
  WHATSAPP_WEB_VERSION,
  type WhatsappChannelConfig,
  type WhatsappChannelKey,
} from '../infrastructure/whatsapp-options';

export type WhatsappQuoteDecision = {
  approved: boolean;
  orderCode?: string;
  orderSuffix?: string;
};

type WhatsappChannelRuntime = {
  client?: Client;
  ready: boolean;
  authenticated: boolean;
  lastQr?: string;
  lastQrImageDataUrl?: string;
  lastError?: string;
  initializing: boolean;
  restoreFailed: boolean;
  localAuthClientId: string;
  processedIncomingMessageIds: Set<string>;
};

export function parseWhatsappQuoteDecision(body: string): WhatsappQuoteDecision | null {
  const normalized = body
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const orderMatch = normalized.match(/\b(ORD-\d{4}-\d{5})\b/);
  const orderCode = orderMatch?.[1];
  const compactOrderMatch = normalized.match(/\bORD\s*(\d{4})\s*(\d{5})\b/);
  const compactOrderCode = compactOrderMatch ? `ORD-${compactOrderMatch[1]}-${compactOrderMatch[2]}` : undefined;
  const orderSuffix = normalized.match(/\b(\d{5})\b/)?.[1];
  const firstToken = normalized.split(' ')[0];

  if (['NO', 'N', '2'].includes(firstToken) || /\b(NO\s+ACEPTO|RECHAZO|RECHAZADO|NO\s+AUTORIZO|NO\s+APRUEBO)\b/.test(normalized)) {
    return {
      approved: false,
      orderCode: orderCode ?? compactOrderCode,
      orderSuffix: orderCode || compactOrderCode ? undefined : orderSuffix,
    };
  }

  if (['SI', 'S', '1'].includes(firstToken) || /\b(SI\s+ACEPTO|ACEPTO|APROBADO|APRUEBO|AUTORIZO)\b/.test(normalized)) {
    return {
      approved: true,
      orderCode: orderCode ?? compactOrderCode,
      orderSuffix: orderCode || compactOrderCode ? undefined : orderSuffix,
    };
  }

  return null;
}

@Injectable()
export class WhatsappService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly runtimes = new Map<WhatsappChannelKey, WhatsappChannelRuntime>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly core: CoreService,
  ) {}

  onModuleInit() {
    for (const channel of WHATSAPP_CHANNELS) {
      if (!this.hasStoredAuthSession(channel.key)) continue;
      const runtime = this.runtime(channel.key);
      this.logger.log(`Se detecto una sesion previa de WhatsApp para ${channel.label}. Intentando restaurarla...`);
      runtime.lastError = undefined;
      runtime.restoreFailed = false;
      runtime.initializing = true;
      void this.initializeClient(channel.key, 1, 'restore');
    }
  }

  async onModuleDestroy() {
    for (const channel of WHATSAPP_CHANNELS) {
      const runtime = this.runtime(channel.key);
      const activeClient = runtime.client;
      runtime.client = undefined;
      runtime.initializing = false;
      runtime.ready = false;
      runtime.authenticated = false;
      runtime.lastQr = undefined;
      runtime.lastQrImageDataUrl = undefined;
      if (activeClient) await activeClient.destroy().catch(() => undefined);
      this.terminateSessionBrowserProcesses(channel.key);
    }
  }

  channels() {
    return WHATSAPP_CHANNELS.map((channel) => {
      const runtime = this.runtime(channel.key);
      return {
        key: channel.key,
        label: channel.label,
        clientId: channel.clientId,
        quoteAutomation: channel.quoteAutomation,
        started: Boolean(runtime.client) || runtime.authenticated,
        initializing: runtime.initializing,
        ready: runtime.ready || runtime.authenticated,
        hasQr: Boolean(runtime.lastQr) && !runtime.authenticated,
        lastError: runtime.lastError,
      };
    });
  }

  start(channelKey: string = DEFAULT_WHATSAPP_CHANNEL_KEY) {
    const channel = this.channel(channelKey);
    const runtime = this.runtime(channel.key);
    if (runtime.client || runtime.initializing) {
      return { status: runtime.ready ? 'READY' : 'STARTING', message: `Cliente WhatsApp ya iniciado para ${channel.label}` };
    }

    runtime.lastError = undefined;
    if (runtime.restoreFailed) {
      this.rotateLocalAuthSession(channel.key);
      runtime.restoreFailed = false;
    }
    runtime.initializing = true;
    void this.initializeClient(channel.key, 1, 'fresh');
    return { status: 'STARTING', message: `Vinculacion por QR iniciada para ${channel.label}`, channelKey: channel.key, channelLabel: channel.label };
  }

  async status(channelKey: string = DEFAULT_WHATSAPP_CHANNEL_KEY) {
    const channel = this.channel(channelKey);
    const runtime = this.runtime(channel.key);
    await this.refreshSessionHealth(channel.key);
    return {
      started: Boolean(runtime.client) || runtime.authenticated,
      initializing: runtime.initializing,
      ready: runtime.ready || runtime.authenticated,
      hasQr: Boolean(runtime.lastQr) && !runtime.authenticated,
      qrCodeDataUrl: runtime.lastQrImageDataUrl,
      lastError: runtime.lastError,
      channelKey: channel.key,
      channelLabel: channel.label,
    };
  }

  async stop(channelKey: string = DEFAULT_WHATSAPP_CHANNEL_KEY) {
    const channel = this.channel(channelKey);
    const runtime = this.runtime(channel.key);
    const activeClient = runtime.client;
    let cleanupWarning: string | undefined;
    runtime.client = undefined;
    runtime.initializing = false;
    runtime.ready = false;
    runtime.authenticated = false;
    runtime.lastQr = undefined;
    runtime.lastQrImageDataUrl = undefined;
    runtime.lastError = undefined;

    if (activeClient) {
      await activeClient.logout().catch(() => undefined);
      await activeClient.destroy().catch(() => undefined);
    }

    this.terminateSessionBrowserProcesses(channel.key);
    const authPath = this.resolveAuthPath(channel.key);
    try {
      fs.rmSync(authPath, { recursive: true, force: true, maxRetries: 5, retryDelay: 1000 });
      this.logger.warn(`Sesion de WhatsApp desvinculada para ${channel.label}. Se limpio ${authPath}`);
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      cleanupWarning =
        'La sesion se detuvo, pero Windows aun mantiene archivos del navegador bloqueados. Cierre Chrome/Edge abiertos por WhatsApp y vuelva a iniciar QR.';
      runtime.lastError = cleanupWarning;
      this.logger.warn(`No se pudo limpiar por completo la sesion de WhatsApp en ${authPath}: ${detail}`);
    }
    return { status: 'STOPPED', message: cleanupWarning ?? `Numero desvinculado correctamente para ${channel.label}`, channelKey: channel.key, channelLabel: channel.label };
  }

  recentMessages(channelKey?: string) {
    const where = channelKey && channelKey !== 'ALL'
      ? this.channel(channelKey).key === 'ORDERS'
        ? ({
            OR: [
              { apiResponse: { path: ['channelKey'], equals: 'ORDERS' } },
              { apiResponse: { path: ['channelKey'], equals: 'WHATSAPP_ORDENES' } },
            ],
          } as Prisma.WhatsappNotificationWhereInput)
        : ({ apiResponse: { path: ['channelKey'], equals: this.channel(channelKey).key } } as Prisma.WhatsappNotificationWhereInput)
      : undefined;

    return this.prisma.whatsappNotification.findMany({
      where,
      orderBy: { sentAt: 'desc' },
      take: 250,
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

  async send(
    orderId: number | undefined,
    destinationPhone: string,
    message: string,
    sentById?: number,
    channelKey: string = DEFAULT_WHATSAPP_CHANNEL_KEY,
  ) {
    const channel = this.channel(channelKey);
    const runtime = this.runtime(channel.key);
    if (!runtime.client || !runtime.ready) {
      return this.log(channel, orderId, destinationPhone, 'manual_message', 'PENDING', message, sentById, {
        reason: 'WhatsApp no esta conectado',
      });
    }

    const chatId = this.normalize(destinationPhone);
    try {
      const result = await runtime.client.sendMessage(chatId, message);
      return this.log(channel, orderId, destinationPhone, 'manual_message', 'SENT', message, sentById, {
        direction: 'OUTBOUND',
        id: result.id.id,
      });
    } catch (error) {
      return this.log(channel, orderId, destinationPhone, 'manual_message', 'FAILED', message, sentById, {
        direction: 'OUTBOUND',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private channel(channelKey: string): WhatsappChannelConfig {
    const normalized = channelKey?.trim() || DEFAULT_WHATSAPP_CHANNEL_KEY;
    const channel = WHATSAPP_CHANNELS.find((item) => item.key === normalized);
    if (!channel) throw new BadRequestException('Canal de WhatsApp no valido');
    return channel;
  }

  private runtime(channelKey: WhatsappChannelKey) {
    const existing = this.runtimes.get(channelKey);
    if (existing) return existing;
    const channel = this.channel(channelKey);
    const runtime: WhatsappChannelRuntime = {
      ready: false,
      authenticated: false,
      initializing: false,
      restoreFailed: false,
      localAuthClientId: channel.clientId,
      processedIncomingMessageIds: new Set<string>(),
    };
    this.runtimes.set(channelKey, runtime);
    return runtime;
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

  private async refreshSessionHealth(channelKey: WhatsappChannelKey) {
    const runtime = this.runtime(channelKey);
    if (!runtime.client) return;
    if (runtime.initializing) return;

    try {
      const state = await runtime.client.getState();
      const normalizedState = String(state ?? '').toUpperCase();

      if (normalizedState === 'CONNECTED') {
        runtime.ready = true;
        runtime.authenticated = true;
        return;
      }

      if (['OPENING', 'PAIRING'].includes(normalizedState)) {
        runtime.initializing = true;
        runtime.ready = false;
        runtime.authenticated = false;
        return;
      }

      if (['UNPAIRED', 'UNPAIRED_IDLE', 'TIMEOUT', 'CONFLICT', 'PROXYBLOCK', 'TOS_BLOCK'].includes(normalizedState)) {
        await this.resetRuntimeSession(channelKey, `La sesion de WhatsApp ya no esta vinculada (${normalizedState}).`);
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
      await this.resetRuntimeSession(channelKey, `No se pudo verificar la sesion actual de WhatsApp: ${detail}`);
    }
  }

  private async initializeClient(channelKey: WhatsappChannelKey, attempt = 1, mode: 'restore' | 'fresh' = 'fresh'): Promise<void> {
    const channel = this.channel(channelKey);
    const runtime = this.runtime(channel.key);
    const browserCandidates = this.resolveBrowserCandidates();
    let lastFailure = 'No se encontro un navegador compatible para iniciar WhatsApp.';
    let sessionPurgedForRecovery = false;
    const restoringStoredSession = mode === 'restore' && this.hasStoredAuthSession(channel.key);
    const startupTimeoutMs = restoringStoredSession ? Math.max(WHATSAPP_STARTUP_TIMEOUT_MS, 180000) : WHATSAPP_STARTUP_TIMEOUT_MS;
    const candidatesToTry = restoringStoredSession ? browserCandidates.slice(0, 1) : browserCandidates;
    this.terminateSessionBrowserProcesses(channel.key);
    this.cleanupAuthRuntimeArtifacts(channel.key, restoringStoredSession ? 'minimal' : 'aggressive');

    for (const browserPath of candidatesToTry) {
      this.logger.log(
        `Iniciando WhatsApp ${channel.label} (intento ${attempt}/${WHATSAPP_START_RETRIES}) con navegador ${browserPath}, headless=${WHATSAPP_HEADLESS}, protocolTimeout=${WHATSAPP_PROTOCOL_TIMEOUT_MS}ms y startupTimeout=${startupTimeoutMs}ms`,
      );

      const clientOptions: ConstructorParameters<typeof Client>[0] = {
        authStrategy: new LocalAuth({ clientId: runtime.localAuthClientId }),
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
      runtime.client = client;

      client.on('qr', (qr) => {
        runtime.lastQr = qr;
        runtime.ready = false;
        runtime.authenticated = false;
        runtime.initializing = false;
        runtime.lastError = undefined;
        void QRCode.toDataURL(qr, { margin: 1, width: 320 })
          .then((value) => {
            runtime.lastQrImageDataUrl = value;
          })
          .catch(() => {
            runtime.lastQrImageDataUrl = undefined;
          });
        this.logger.log(`Escanee el QR de ${channel.label} desde WhatsApp > Dispositivos vinculados.`);
        qrcode.generate(qr, { small: true });
      });

      client.on('authenticated', () => {
        runtime.authenticated = true;
        runtime.initializing = false;
        runtime.lastQr = undefined;
        runtime.lastQrImageDataUrl = undefined;
        runtime.lastError = undefined;
        this.logger.log(`Sesion de WhatsApp autenticada para ${channel.label}. Finalizando sincronizacion...`);
      });

      client.on('ready', () => {
        runtime.ready = true;
        runtime.authenticated = true;
        runtime.initializing = false;
        runtime.lastQr = undefined;
        runtime.lastQrImageDataUrl = undefined;
        this.logger.log(`WhatsApp conectado como dispositivo secundario para ${channel.label}.`);
      });

      client.on('message', (message) => {
        void this.handleIncomingMessage(channel.key, message);
      });

      client.on('message_create', (message) => {
        void this.handleIncomingMessage(channel.key, message);
      });

      client.on('disconnected', (reason) => {
        runtime.ready = false;
        runtime.authenticated = false;
        runtime.initializing = false;
        runtime.lastQr = undefined;
        runtime.lastQrImageDataUrl = undefined;
        this.logger.warn(`WhatsApp ${channel.label} desconectado: ${reason}`);
        if (runtime.client === client) runtime.client = undefined;
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
        runtime.ready = false;
        runtime.authenticated = false;
        runtime.initializing = false;
        runtime.lastQr = undefined;
        runtime.lastQrImageDataUrl = undefined;
        runtime.lastError = detail;
        await client.destroy().catch(() => undefined);
        if (runtime.client === client) runtime.client = undefined;
        this.terminateSessionBrowserProcesses(channel.key);
        await this.pause(800);
        this.cleanupAuthRuntimeArtifacts(channel.key, restoringStoredSession ? 'minimal' : 'aggressive');
        this.logger.error(`No se pudo iniciar WhatsApp ${channel.label} con ${browserPath}: ${detail}`);

        if (!restoringStoredSession && !sessionPurgedForRecovery && this.shouldRecreateAuthSession(detail)) {
          sessionPurgedForRecovery = true;
          this.purgeAuthSession(channel.key);
          this.rotateLocalAuthSession(channel.key);
          break;
        }
      }
    }

    if (restoringStoredSession) {
      runtime.initializing = false;
      runtime.client = undefined;
      runtime.restoreFailed = true;
      runtime.lastError =
        `No se pudo restaurar automaticamente la sesion activa de ${channel.label}. Si el telefono aun aparece vinculado, espere un momento y vuelva a intentar; de lo contrario, use Desvincular e Iniciar QR.`;
      this.logger.warn(runtime.lastError);
      return;
    }

    if (sessionPurgedForRecovery && attempt < WHATSAPP_START_RETRIES) {
      runtime.initializing = true;
      this.logger.warn(`Se limpio la sesion local de ${channel.label}. Reintentando en ${WHATSAPP_START_RETRY_DELAY_MS}ms...`);
      await this.pause(WHATSAPP_START_RETRY_DELAY_MS);
      return this.initializeClient(channel.key, attempt + 1, mode);
    }

    if (attempt < WHATSAPP_START_RETRIES && this.isTransientStartupError(lastFailure)) {
      runtime.initializing = true;
      this.logger.warn(`Reintentando inicio de ${channel.label} en ${WHATSAPP_START_RETRY_DELAY_MS}ms...`);
      await this.pause(WHATSAPP_START_RETRY_DELAY_MS);
      return this.initializeClient(channel.key, attempt + 1, mode);
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

  private log(
    channel: WhatsappChannelConfig,
    orderId: number | undefined,
    destinationPhone: string,
    template: string,
    deliveryStatus: string,
    message: string,
    sentById: number | undefined,
    apiResponse: Record<string, unknown>,
  ) {
    return this.prisma.whatsappNotification.create({
      data: {
        orderId,
        destinationPhone,
        template,
        deliveryStatus,
        message,
        sentById,
        apiResponse: {
          ...apiResponse,
          channelKey: channel.key,
          channelLabel: channel.label,
        } as Prisma.InputJsonObject,
      },
    });
  }

  private async handleIncomingMessage(channelKey: WhatsappChannelKey, message: Message) {
    const channel = this.channel(channelKey);
    const runtime = this.runtime(channel.key);
    if (message.fromMe || !message.from.endsWith('@c.us')) return;

    const messageId = message.id._serialized || message.id.id;
    if (runtime.processedIncomingMessageIds.has(messageId)) return;
    runtime.processedIncomingMessageIds.add(messageId);
    if (runtime.processedIncomingMessageIds.size > 500) {
      const oldest = runtime.processedIncomingMessageIds.values().next().value as string | undefined;
      if (oldest) runtime.processedIncomingMessageIds.delete(oldest);
    }

    const rawMessage = message as typeof message & { _data?: { notifyName?: string } };
    const sourcePhone = message.from.replace('@c.us', '');

    await this.log(channel, undefined, sourcePhone, 'incoming_message', 'RECEIVED', message.body, undefined, {
      direction: 'INBOUND',
      from: message.from,
      messageId,
      pushName: rawMessage._data?.notifyName ?? null,
      timestamp: message.timestamp,
    }).catch((error: unknown) => {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.warn(`No se pudo registrar mensaje entrante: ${detail}`);
    });

    if (!channel.quoteAutomation) return;

    await this.tryAutoQuoteDecision(channel, sourcePhone, message.body, rawMessage._data?.notifyName ?? undefined).catch((error: unknown) => {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.warn(`No se pudo procesar decision automatica por WhatsApp: ${detail}`);
    });

    await this.tryReplyToAmbiguousQuoteDecision(channel, sourcePhone, message.body).catch((error: unknown) => {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.warn(`No se pudo responder decision ambigua por WhatsApp: ${detail}`);
    });
  }

  private async tryAutoQuoteDecision(channel: WhatsappChannelConfig, sourcePhone: string, body: string, customerName?: string) {
    const decision = parseWhatsappQuoteDecision(body);
    if (!decision) return;

    const pendingOrders = await this.core.findPendingQuoteOrdersByPhone(sourcePhone);

    if (!decision.orderCode && decision.orderSuffix) {
      const matchingOrders = pendingOrders.filter((order) => order.orderCode.endsWith(decision.orderSuffix!));
      if (matchingOrders.length === 1) {
        decision.orderCode = matchingOrders[0].orderCode;
      }
    }

    if (!decision.orderCode) {
      if (pendingOrders.length !== 1) return;
      decision.orderCode = pendingOrders[0].orderCode;
    }

    const updated = await this.core.customerQuoteDecisionFromWhatsapp(
      decision.orderCode,
      decision.approved,
      sourcePhone,
      customerName,
      body,
    );

    await this.log(channel, updated.id, sourcePhone, 'auto_quote_decision', 'PROCESSED', body, undefined, {
      direction: 'SYSTEM',
      decision: decision.approved ? 'ACCEPTED' : 'REJECTED',
      orderCode: decision.orderCode,
      reason: 'short_reply_interpreted',
    });

    this.logger.log(
      `Decision automatica registrada por WhatsApp para ${decision.orderCode}: ${decision.approved ? 'ACEPTADA' : 'RECHAZADA'}`,
    );
  }

  private async tryReplyToAmbiguousQuoteDecision(channel: WhatsappChannelConfig, sourcePhone: string, body: string) {
    const runtime = this.runtime(channel.key);
    const decision = parseWhatsappQuoteDecision(body);
    if (!decision || decision.orderCode || !runtime.client || !runtime.ready) return;

    const pendingOrders = await this.core.findPendingQuoteOrdersByPhone(sourcePhone);
    if (decision.orderSuffix && pendingOrders.filter((order) => order.orderCode.endsWith(decision.orderSuffix!)).length === 1) return;
    if (pendingOrders.length === 1) return;
    const example = pendingOrders.length
      ? pendingOrders
          .slice(0, 5)
          .map((order) => `- ${order.orderCode.slice(-5)} (${order.orderCode})`)
          .join('\n')
      : '- ORD-2026-00003';

    const reply = pendingOrders.length
      ? `Tiene varias ordenes pendientes. Responda solo con:\nSI 00000 para aceptar\nNO 00000 para rechazar\n\nCodigos pendientes:\n${example}`
      : `Para registrar su respuesta necesitamos el codigo de orden.\n\nResponda solo con:\nSI 00000 para aceptar\nNO 00000 para rechazar`;

    const result = await runtime.client.sendMessage(this.normalize(sourcePhone), reply);
    await this.log(channel, undefined, sourcePhone, 'auto_reply_missing_order_code', 'SENT', reply, undefined, {
      direction: 'OUTBOUND',
      id: result.id.id,
      reason: 'missing_order_code',
      decision: decision.approved ? 'ACCEPTED' : 'REJECTED',
    });
  }

  private resolveAuthPath(channelKey: WhatsappChannelKey) {
    const runtime = this.runtime(channelKey);
    return path.resolve(process.cwd(), '.wwebjs_auth', `session-${runtime.localAuthClientId}`);
  }

  private hasStoredAuthSession(channelKey: WhatsappChannelKey) {
    const authPath = this.resolveAuthPath(channelKey);
    return fs.existsSync(authPath) && fs.readdirSync(authPath).length > 0;
  }

  private cleanupAuthRuntimeArtifacts(channelKey: WhatsappChannelKey, mode: 'minimal' | 'aggressive' = 'aggressive') {
    const authPath = this.resolveAuthPath(channelKey);
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
        if (fs.existsSync(filePath)) fs.rmSync(filePath, { force: true });
      } catch (error: unknown) {
        const detail = error instanceof Error ? error.message : String(error);
        this.logger.warn(`No se pudo limpiar el lock ${filePath}: ${detail}`);
      }
    }

    if (mode === 'aggressive') {
      for (const dirPath of volatileDirectories) {
        try {
          if (fs.existsSync(dirPath)) fs.rmSync(dirPath, { recursive: true, force: true });
        } catch (error: unknown) {
          const detail = error instanceof Error ? error.message : String(error);
          this.logger.warn(`No se pudo limpiar cache temporal de Chromium ${dirPath}: ${detail}`);
        }
      }

      for (const filePath of volatileFiles) {
        try {
          if (fs.existsSync(filePath)) fs.rmSync(filePath, { force: true });
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

  private purgeAuthSession(channelKey: WhatsappChannelKey) {
    const authPath = this.resolveAuthPath(channelKey);
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        this.terminateSessionBrowserProcesses(channelKey);
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 600);
        this.cleanupAuthRuntimeArtifacts(channelKey);
        fs.rmSync(authPath, { recursive: true, force: true });
        this.logger.warn(`Se elimino la sesion local de WhatsApp para iniciar una vinculacion limpia: ${authPath}`);
        return;
      } catch (error: unknown) {
        const detail = error instanceof Error ? error.message : String(error);
        if (attempt === 3) this.logger.warn(`No se pudo eliminar la sesion local de WhatsApp en ${authPath}: ${detail}`);
      }
    }
  }

  private rotateLocalAuthSession(channelKey: WhatsappChannelKey) {
    const runtime = this.runtime(channelKey);
    runtime.localAuthClientId = `${this.channel(channelKey).clientId}-fresh-${Date.now()}`;
    this.logger.warn(`Se usara una sesion local nueva de WhatsApp: ${runtime.localAuthClientId}`);
  }

  private pause(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private terminateSessionBrowserProcesses(channelKey: WhatsappChannelKey) {
    const authPath = this.resolveAuthPath(channelKey);
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

        const output = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsHide: true,
        })
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

  private async resetRuntimeSession(channelKey: WhatsappChannelKey, reason: string) {
    const runtime = this.runtime(channelKey);
    const activeClient = runtime.client;
    runtime.client = undefined;
    runtime.initializing = false;
    runtime.ready = false;
    runtime.authenticated = false;
    runtime.lastQr = undefined;
    runtime.lastQrImageDataUrl = undefined;
    runtime.lastError = reason;
    if (activeClient) await activeClient.destroy().catch(() => undefined);
    this.logger.warn(reason);
  }
}
