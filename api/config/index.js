export const CONFIG = {
  PORT: Number(process.env.PORT) || 3000,
  DB_PATH: process.env.DB_PATH || './data/timeline.db',
  SESSION_DURATION: Number(process.env.SESSION_DURATION) || 24 * 60 * 60 * 1000,
  SESSION_CLEANUP_INTERVAL: 6 * 60 * 60 * 1000,
  STATIC_CACHE_MAX_AGE: 31536000,
  MAX_REQUEST_BODY_SIZE: 1024 * 1024,
  DEFAULT_PASSWORD: process.env.DEFAULT_PASSWORD || 'REDACTED'
}

export const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)
  .concat([
    'http://localhost:5174',
    'http://127.0.0.1:5174',
    'http://localhost:3000',
    'http://127.0.0.1:3000'
  ])
