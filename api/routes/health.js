import { jsonResponse } from '../utils/response.js'

export function healthRoutes(req, { method, pathname }) {
  if (pathname === '/api/health' && method === 'GET') {
    return jsonResponse({ status: 'ok' }, 200)
  }
  return null
}
