import { settingsController } from '../controllers/settings.controller.js'
import { requireAuth } from '../middleware/auth.js'
import { errorResponse } from '../utils/response.js'
import { getCorsHeaders } from '../middleware/cors.js'

export function settingsRoutes(req) {
  const url = new URL(req.url)
  const path = url.pathname

  if (path === '/api/settings' && req.method === 'GET') {
    if (!requireAuth(req)) {
      return errorResponse('未授权', 401, getCorsHeaders(req))
    }
    return settingsController.getSettings(req)
  }

  if (path === '/api/first-meeting' && req.method === 'POST') {
    if (!requireAuth(req)) {
      return errorResponse('未授权', 401, getCorsHeaders(req))
    }
    return settingsController.setFirstMeeting(req)
  }

  return null
}