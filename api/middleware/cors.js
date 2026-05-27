import { ALLOWED_ORIGINS } from '../config/index.js'

/**
 * 获取CORS响应头
 * @param {Request} req 请求对象
 * @returns {object} CORS头
 */
export function getCorsHeaders(req) {
  const origin = req.headers.get('origin') || ''
  const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : 'null'

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  }
}

/**
 * CORS中间件
 * @param {Request} req 请求对象
 * @returns {Response|null} 预检请求返回响应，否则返回null
 */
export function corsMiddleware(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(req)
    })
  }
  return null
}