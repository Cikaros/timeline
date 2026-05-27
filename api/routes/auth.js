import { authController } from '../controllers/auth.controller.js'
import { requireAuth } from '../middleware/auth.js'
import { errorResponse } from '../utils/response.js'
import { getCorsHeaders } from '../middleware/cors.js'

export function authRoutes(req) {
  const url = new URL(req.url)
  const path = url.pathname

  if (path === '/api/login' && req.method === 'POST') {
    return authController.login(req)
  }

  if (path === '/api/logout' && req.method === 'POST') {
    return authController.logout(req)
  }

  if (path === '/api/password' && req.method === 'POST') {
    if (!requireAuth(req)) {
      return errorResponse('未授权', 401, getCorsHeaders(req))
    }
    return authController.changePassword(req)
  }

  return null
}