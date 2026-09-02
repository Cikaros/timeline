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
  if (!token) return false

  const tokenHash = hashSessionToken(token)
  const row = preparedStatements.getSession.get(tokenHash)
  if (!row) return false

  if (Date.now() > row.expires) {
    preparedStatements.deleteSession.run(tokenHash)
    return false
  }
  return true
}

export function requireAuth(req) {
  const cookies = parseCookies(req.headers.get('cookie') || '')
  const token = cookies['session']
  return verifySession(token) ? token : null
}

function usesDefaultPassword() {
  return preparedStatements.getSetting.get('password_is_default')?.value === '1'
}

export function withAuth(handler) {
  return async (req, ...args) => {
    if (!requireAuth(req)) {
      return errorResponse('未授权', 401, getCorsHeaders(req))
    }

    if (usesDefaultPassword()) {
      const url = new URL(req.url)
      const canReadSettings = url.pathname === '/api/settings' && req.method === 'GET'
      if (url.pathname !== '/api/password' && !canReadSettings) {
        return errorResponse('请先修改默认密码', 403, getCorsHeaders(req))
      }
    }

    return handler(req, ...args)
  }
}
