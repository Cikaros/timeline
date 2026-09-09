import { caldavController } from '../controllers/caldav.controller.js'

export function caldavRoutes(req, context) {
  if (context.pathname === '/.well-known/caldav' || context.pathname === '/.well-known/caldav/') {
    return new Response(null, {
      status: 307,
      headers: { Location: '/caldav/' }
    })
  }

  if (context.pathname === '/caldav' || context.pathname.startsWith('/caldav/')) {
    return caldavController.handle(req, context)
  }

  return null
}
