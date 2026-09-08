import { subscriptionsController } from '../controllers/subscriptions.controller.js'
import { withAuth } from '../middleware/auth.js'

export function subscriptionsRoutes(req, { method, pathname }) {
  if (pathname === '/api/calendar-subscriptions') {
    if (method === 'GET') {
      return withAuth(subscriptionsController.list)(req)
    }

    if (method === 'POST') {
      return withAuth(subscriptionsController.create)(req)
    }
  }

  const subscriptionMatch = pathname.match(/^\/api\/calendar-subscriptions\/(\d+)$/)
  if (subscriptionMatch) {
    const id = Number(subscriptionMatch[1])
    if (id <= 0) return null

    if (method === 'POST') {
      return withAuth(subscriptionsController.update)(req, id)
    }

    if (method === 'DELETE') {
      return withAuth(subscriptionsController.remove)(req, id)
    }
  }

  const icsMatch = pathname.match(/^\/api\/calendar\/([A-Za-z0-9-]+)\.ics$/)
  if (icsMatch && method === 'GET') {
    return subscriptionsController.getIcs(req, icsMatch[1])
  }

  return null
}
