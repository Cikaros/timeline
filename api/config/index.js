export const CONFIG = {
  PORT: 3000,
  DB_PATH: './data/timeline.db',
  SESSION_DURATION: 24 * 60 * 60 * 1000, // 24小时
  SESSION_CLEANUP_INTERVAL: 6 * 60 * 60 * 1000, // 每6小时清理过期会话
  STATIC_CACHE_MAX_AGE: 31536000, // 静态文件缓存1年
  MAX_REQUEST_BODY_SIZE: 1024 * 1024, // 最大请求体1MB
  DEFAULT_PASSWORD: 'REDACTED'
}

export const ALLOWED_ORIGINS = [
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
]