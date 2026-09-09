export const CONFIG = {
  PORT: Number(process.env.PORT) || 3000,
  PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL?.replace(/\/+$/, '') || '',
  CALDAV_DEBUG: ['1', 'true'].includes(process.env.CALDAV_DEBUG?.toLowerCase()),
  DB_PATH: process.env.DB_PATH || './data/timeline.db',
  SESSION_DURATION: Number(process.env.SESSION_DURATION) || 24 * 60 * 60 * 1000,
  SESSION_CLEANUP_INTERVAL: 6 * 60 * 60 * 1000,
  STATIC_CACHE_MAX_AGE: 31536000,
  MAX_REQUEST_BODY_SIZE: 1024 * 1024,
  DEFAULT_PASSWORD: process.env.DEFAULT_PASSWORD || ''
}
