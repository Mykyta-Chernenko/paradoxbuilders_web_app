export const IS_DEV = process.env.NEXT_PUBLIC_APP_ENVIRONMENT !== 'production';
export const APP_URL = IS_DEV
  ? 'http://localhost:3000'
  : 'https://example.com/';
export const APP_VERSION = '0.1.0';

export const SUPPORT_EMAIL = "support@example.com";
