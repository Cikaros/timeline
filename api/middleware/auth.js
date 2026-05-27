import { preparedStatements } from '../db/index.js'

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
      const [k, v] = c.split('=')
      acc[k] = v
      return acc
    }, {})
}

/**
 * 验证会话
 * @param {string} token 会话令牌
 * @returns {boolean} 验证结果
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