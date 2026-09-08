import { accountsController } from '../controllers/accounts.controller.js'
import { authController } from '../controllers/auth.controller.js'
import { withAuth } from '../middleware/auth.js'

export function accountsRoutes(req, { method, pathname }) {
  if (pathname === '/api/accounts') {
    if (method === 'GET') {
      return withAuth(accountsController.list)(req)
    }

    if (method === 'POST') {
      return withAuth(accountsController.create)(req)
    }
  }

  if (pathname === '/api/accounts/password' && method === 'POST') {
    return withAuth(authController.changePassword)(req)
  }

  const accountMatch = pathname.match(/^\/api\/accounts\/(\d+)$/)
  if (accountMatch && method === 'DELETE') {
    return withAuth(accountsController.remove)(req, Number(accountMatch[1]))
  }

  return null
}
