import { Client, LocalAuth } from 'whatsapp-web.js';
import * as qrcode from 'qrcode-terminal';
import * as fs from 'node:fs';
import { WHATSAPP_WEB_CACHE, WHATSAPP_WEB_VERSION } from './modules/whatsapp/infrastructure/whatsapp-options';

function resolveBrowserPath() {
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

const executablePath = resolveBrowserPath();

console.log('Iniciando cliente WhatsApp...');
console.log(`Navegador detectado: ${executablePath ?? 'Puppeteer default'}`);
console.log(`Version WhatsApp Web: ${WHATSAPP_WEB_VERSION}`);
console.log('Cuando aparezca el QR, escaneelo desde WhatsApp > Dispositivos vinculados.');

const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'plataforma-talleres-electronicos' }),
  webVersion: WHATSAPP_WEB_VERSION,
  webVersionCache: WHATSAPP_WEB_CACHE,
  puppeteer: {
    headless: true,
    executablePath,
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

client.on('qr', (qr) => {
  console.clear();
  console.log('Escanee este QR desde WhatsApp > Dispositivos vinculados:\n');
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('\nWhatsApp conectado correctamente. Puede dejar esta terminal abierta.');
});

client.on('authenticated', () => {
  console.log('\nSesion autenticada.');
});

client.on('auth_failure', (message) => {
  console.error(`Fallo de autenticacion: ${message}`);
});

client.on('disconnected', (reason) => {
  console.warn(`WhatsApp desconectado: ${reason}`);
});

client.initialize().catch((error: unknown) => {
  console.error('No se pudo iniciar WhatsApp.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
