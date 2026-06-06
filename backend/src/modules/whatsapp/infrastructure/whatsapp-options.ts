export type WhatsappChannelKey = 'ORDERS' | 'SALES_SUPPORT';

export type WhatsappChannelConfig = {
  key: WhatsappChannelKey;
  label: string;
  clientId: string;
  quoteAutomation: boolean;
};

export const DEFAULT_WHATSAPP_CHANNEL_KEY: WhatsappChannelKey = 'ORDERS';

export const WHATSAPP_CHANNELS: WhatsappChannelConfig[] = [
  {
    key: 'ORDERS',
    label: process.env.WHATSAPP_ORDERS_CHANNEL_LABEL?.trim() || 'Canal ordenes',
    clientId: process.env.WHATSAPP_ORDERS_CLIENT_ID?.trim() || 'orders',
    quoteAutomation: true,
  },
  {
    key: 'SALES_SUPPORT',
    label: process.env.WHATSAPP_SALES_CHANNEL_LABEL?.trim() || 'Ventas y atencion',
    clientId: process.env.WHATSAPP_SALES_CLIENT_ID?.trim() || 'sales-support',
    quoteAutomation: false,
  },
];

export const WHATSAPP_CHANNEL_KEY = DEFAULT_WHATSAPP_CHANNEL_KEY;
export const WHATSAPP_CHANNEL_LABEL = WHATSAPP_CHANNELS[0].label;
export const WHATSAPP_CLIENT_ID = WHATSAPP_CHANNELS[0].clientId;
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
