import { requestBaseUrl } from '../utils/request.js'

export function isAllowedOrigin(req) {
  const origin = req.headers.get('origin')
  if (!origin) return true
  return origin === requestBaseUrl(req)
}

/**
 * 获取CORS响应头
 * @param {Request} req 请求对象
 * @returns {object} CORS头
 */
export function getCorsHeaders(req) {
  const origin = req.headers.get('origin') || ''

  // 只接受当前代理源，防止任意站点携带 Cookie 跨域调用。
  if (!isAllowedOrigin(req)) {
    return {}
  }

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  }
}

/**
 * CORS中间件
 * @param {Request} req 请求对象
 * @param {object} corsHeaders 预计算的CORS头（避免重复计算）
 * @returns {Response|null} 预检请求返回响应，否则返回null
 */
export function corsMiddleware(req, corsHeaders) {
  // CalDAV clients also use OPTIONS to advertise DAV compliance classes;
  // only an actual browser CORS preflight should be short-circuited here.
  const isPreflight = req.headers.has('origin') && req.headers.has('access-control-request-method')
  if (req.method === 'OPTIONS' && isPreflight) {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    })
  }
  return null
}
