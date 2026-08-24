import { authController } from '../controllers/auth.controller.js'
import { withAuth } from '../middleware/auth.js'

export function authRoutes(req, { method, pathname }) {
  if (pathname === '/api/login' && method === 'POST') {
    return authController.login(req)
  }

  if (pathname === '/api/logout' && method === 'POST') {
    return authController.logout(req)
  }

  if (pathname === '/api/password' && method === 'POST') {
    return withAuth(authController.changePassword)(req)
  }

  return null
}
