import { preparedStatements } from '../db/index.js'
import { getCorsHeaders } from './cors.js'
import { errorResponse } from '../utils/response.js'
import { hashSessionToken } from '../utils/crypto.js'

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

export function verifySession(token) {
  if (!token) return null

  const tokenHash = hashSessionToken(token)
  const row = preparedStatements.getSession.get(tokenHash)
  if (!row) return false

  if (!row.user_id || Date.now() > row.expires) {
    preparedStatements.deleteSession.run(tokenHash)
    return null
  }

  return {
    token,
    userId: row.user_id,
    username: row.username
  }
}

export function requireAuth(req) {
  const cookies = parseCookies(req.headers.get('cookie') || '')
  const token = cookies['session']
  return verifySession(token)
}

const requestAuth = new WeakMap()

export function getCurrentUser(req) {
  return requestAuth.get(req) || null
}

function usesDefaultPassword() {
  return preparedStatements.getSetting.get('password_is_default')?.value === '1'
}

const passwordChangePaths = new Set(['/api/password', '/api/accounts/password'])

export function withAuth(handler) {
  return async (req, ...args) => {
    const auth = requireAuth(req)
    if (!auth) {
      return errorResponse('未授权', 401, getCorsHeaders(req))
    }

    requestAuth.set(req, auth)

    if (usesDefaultPassword()) {
      const url = new URL(req.url)
      const canReadSettings = url.pathname === '/api/settings' && req.method === 'GET'
      if (!passwordChangePaths.has(url.pathname) && !canReadSettings) {
        return errorResponse('请先修改默认密码', 403, getCorsHeaders(req))
      }
    }

    return handler(req, ...args)
  }
}
