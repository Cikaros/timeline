import { preparedStatements } from '../db/index.js'
import { getCorsHeaders } from './cors.js'
import { errorResponse } from '../utils/response.js'

/**
 * 解析Cookie
 * @param {string} cookieHeader Cookie头
 * @returns {object} 解析后的Cookie对象
 */
export function parseCookies(cookieHeader) {
  if (!cookieHeader) return {}
  return cookieHeader.split(';')
    .map(s => s.trim())
    .filter(Boolean)
    .reduce((acc, c) => {
      const eqIdx = c.indexOf('=')
      if (eqIdx === -1) return acc
      acc[c.slice(0, eqIdx)] = c.slice(eqIdx + 1)
      return acc
    }, {})
}

/**
 * 验证会话
 */
export function verifySession(token) {
  if (!token) return false

  const row = preparedStatements.getSession.get(token)
  if (!row) return false

  if (Date.now() > row.expires) {
    preparedStatements.deleteSession.run(token)
    return false
  }

  return true
}

/**
 * 身份验证中间件
 * @param {Request} req 请求对象
 * @returns {string|null} 验证通过返回token，否则返回null
 */
export function requireAuth(req) {
  const cookies = parseCookies(req.headers.get('cookie') || '')
  const token = cookies['session']
  return verifySession(token) ? token : null
}

/**
 * 认证包装器：自动处理认证检查
 * @param {function} handler 受保护的路由处理器
 * @returns {function} 包装后的处理器
 */
export function withAuth(handler) {
  return async (req, ...args) => {
    if (!requireAuth(req)) {
      return errorResponse('未授权', 401, getCorsHeaders(req))
    }
    return handler(req, ...args)
  }
}
