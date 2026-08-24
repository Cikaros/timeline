import { settingsController } from '../controllers/settings.controller.js'
import { withAuth } from '../middleware/auth.js'

export function settingsRoutes(req, { method, pathname }) {
  if (pathname === '/api/settings' && method === 'GET') {
    return withAuth(settingsController.getSettings)(req)
  }

  if (pathname === '/api/first-meeting' && method === 'POST') {
    return withAuth(settingsController.setFirstMeeting)(req)
  }

  return null
}
