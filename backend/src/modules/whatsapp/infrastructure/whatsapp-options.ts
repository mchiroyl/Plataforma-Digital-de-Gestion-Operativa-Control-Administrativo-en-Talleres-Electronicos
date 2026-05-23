export const WHATSAPP_CLIENT_ID = process.env.WHATSAPP_CLIENT_ID?.trim() || 'plataforma-talleres-electronicos';
export const WHATSAPP_CHANNEL_KEY = process.env.WHATSAPP_CHANNEL_KEY?.trim() || 'WHATSAPP_ORDENES';
export const WHATSAPP_CHANNEL_LABEL = process.env.WHATSAPP_CHANNEL_LABEL?.trim() || 'Canal ordenes';
const configuredWhatsappWebVersion = process.env.WHATSAPP_WEB_VERSION?.trim();
export const WHATSAPP_WEB_VERSION = configuredWhatsappWebVersion ? configuredWhatsappWebVersion : undefined;
export const WHATSAPP_PROTOCOL_TIMEOUT_MS = Number(process.env.WHATSAPP_PROTOCOL_TIMEOUT_MS ?? 300000);
export const WHATSAPP_START_RETRIES = Number(process.env.WHATSAPP_START_RETRIES ?? 2);
export const WHATSAPP_START_RETRY_DELAY_MS = Number(process.env.WHATSAPP_START_RETRY_DELAY_MS ?? 2500);
export const WHATSAPP_STARTUP_TIMEOUT_MS = Number(process.env.WHATSAPP_STARTUP_TIMEOUT_MS ?? 45000);
export const WHATSAPP_HEADLESS = (process.env.WHATSAPP_HEADLESS ?? 'true').toLowerCase() === 'true';

export const WHATSAPP_WEB_CACHE = {
  type: 'local' as const,
};
