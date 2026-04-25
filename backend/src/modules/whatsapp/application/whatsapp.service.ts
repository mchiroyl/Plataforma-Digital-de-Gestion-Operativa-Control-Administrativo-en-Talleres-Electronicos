import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Client, LocalAuth } from 'whatsapp-web.js';
import * as qrcode from 'qrcode-terminal';
import * as fs from 'node:fs';
import { PrismaService } from '../../../shared/infrastructure/persistence/prisma/prisma.service';
import { WHATSAPP_WEB_CACHE, WHATSAPP_WEB_VERSION } from '../infrastructure/whatsapp-options';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private client?: Client;
  private ready = false;
  private lastQr?: string;
  private lastError?: string;
  private initializing = false;

  constructor(private readonly prisma: PrismaService) {}

  start() {
    if (this.client || this.initializing) return { status: this.ready ? 'READY' : 'STARTING', message: 'Cliente WhatsApp ya iniciado' };

    this.lastError = undefined;
    this.initializing = true;
    this.client = new Client({
      authStrategy: new LocalAuth({ clientId: 'plataforma-talleres-electronicos' }),
      webVersion: WHATSAPP_WEB_VERSION,
      webVersionCache: WHATSAPP_WEB_CACHE,
      puppeteer: {
        headless: true,
        executablePath: this.resolveBrowserPath(),
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-extensions',
          '--disable-gpu',
          '--no-first-run',
          '--no-default-browser-check',
          '--disable-background-networking',
          '--disable-sync',
        ],
      },
      takeoverOnConflict: true,
      takeoverTimeoutMs: 0,
      qrMaxRetries: 0,
    });

    this.client.on('qr', (qr) => {
      this.lastQr = qr;
      this.ready = false;
      this.initializing = false;
      this.logger.log('Escanee el QR desde WhatsApp > Dispositivos vinculados.');
      qrcode.generate(qr, { small: true });
    });

    this.client.on('ready', () => {
      this.ready = true;
      this.initializing = false;
      this.logger.log('WhatsApp conectado como dispositivo secundario.');
    });

    this.client.on('disconnected', (reason) => {
      this.ready = false;
      this.initializing = false;
      this.logger.warn(`WhatsApp desconectado: ${reason}`);
      this.client = undefined;
    });

    this.client.initialize().catch((error: unknown) => {
      this.ready = false;
      this.initializing = false;
      this.lastQr = undefined;
      this.lastError = error instanceof Error ? error.message : String(error);
      this.logger.error(`No se pudo iniciar WhatsApp: ${this.lastError}`);
      void this.client?.destroy().catch(() => undefined);
      this.client = undefined;
    });
    return { status: 'STARTING', message: 'Revise la terminal del backend para escanear el QR' };
  }

  status() {
    return {
      started: Boolean(this.client),
      initializing: this.initializing,
      ready: this.ready,
      hasQr: Boolean(this.lastQr),
      lastError: this.lastError,
    };
  }

  async send(orderId: number | undefined, destinationPhone: string, message: string, sentById?: number) {
    if (!this.client || !this.ready) {
      return this.log(orderId, destinationPhone, 'manual_message', 'PENDING', message, sentById, {
        reason: 'WhatsApp no esta conectado',
      });
    }

    const chatId = this.normalize(destinationPhone);
    try {
      const result = await this.client.sendMessage(chatId, message);
      return this.log(orderId, destinationPhone, 'manual_message', 'SENT', message, sentById, {
        id: result.id.id,
      });
    } catch (error) {
      return this.log(orderId, destinationPhone, 'manual_message', 'FAILED', message, sentById, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private normalize(phone: string) {
    const digits = phone.replace(/\D/g, '');
    const withCountry = digits.length === 8 ? `502${digits}` : digits;
    return `${withCountry}@c.us`;
  }

  private resolveBrowserPath() {
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

    return candidates.find((candidate) => fs.existsSync(candidate));
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
}
