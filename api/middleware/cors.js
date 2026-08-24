import { ALLOWED_ORIGINS } from '../config/index.js'

/**
 * 获取CORS响应头
 * @param {Request} req 请求对象
 * @returns {object} CORS头
 */
export function getCorsHeaders(req) {
  const origin = req.headers.get('origin') || ''

  // 非白名单来源不设置 CORS 头，浏览器将阻止跨域请求
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
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
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    })
  }
  return null
}