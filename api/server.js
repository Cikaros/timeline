import { resolve } from 'node:path'
import { CONFIG } from './config/index.js'
import { corsMiddleware, getCorsHeaders, isAllowedOrigin } from './middleware/cors.js'
import { authRoutes } from './routes/auth.js'
import { healthRoutes } from './routes/health.js'
import { settingsRoutes } from './routes/settings.js'
import { meetingsRoutes } from './routes/meetings.js'
import { accountsRoutes } from './routes/accounts.js'
import { subscriptionsRoutes } from './routes/subscriptions.js'
import { caldavRoutes } from './routes/caldav.js'
import { jsonResponse, errorResponse } from './utils/response.js'
import { initializeDefaultAccount } from './services/users.service.js'
import { startScheduledTasks } from './utils/tasks.js'

const STATIC_ROOT = resolve(import.meta.dirname, '../dist')

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '0',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
}

function withSecurityHeaders(response) {
  const headers = new Headers(response.headers)
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(key, value)
  }
  if (process.env.NODE_ENV === 'production') {
    headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  })
}

async function staticFileHandler(pathname) {
  if (process.env.NODE_ENV !== 'production') {
    return errorResponse('开发模式下请访问前端开发服务器：http://localhost:5174', 404)
  }

  const relativePath = pathname === '/' ? '/index.html' : pathname
  const filePath = resolve(STATIC_ROOT, '.' + relativePath)
  if (!filePath.startsWith(STATIC_ROOT + '/')) {
    return errorResponse('Forbidden', 403)
  }

  try {
    const file = Bun.file(filePath)
    if (!await file.exists()) {
      if (pathname.startsWith('/assets/')) {
        return errorResponse('Not Found', 404)
      }
      return new Response(Bun.file(resolve(STATIC_ROOT, 'index.html')), {
        headers: { 'Content-Type': 'text/html', 'Cache-Control': 'no-cache' }
      })
    }

    const headers = {
      'Content-Type': file.type,
      'Cache-Control': pathname.startsWith('/assets/')
        ? `public, max-age=${CONFIG.STATIC_CACHE_MAX_AGE}, immutable`
        : 'no-cache'
    }
    return new Response(file, { headers })
  } catch (e) {
    return errorResponse('Not Found', 404)
  }
}

await initializeDefaultAccount()
startScheduledTasks()

console.log(`🚀 后端服务已启动：http://localhost:${CONFIG.PORT}`)
console.log(`📁 数据库文件：${CONFIG.DB_PATH}`)
console.log(`🌍 开发环境前端地址：http://localhost:5174`)

export default Bun.serve({
  port: CONFIG.PORT,
  maxRequestBodySize: CONFIG.MAX_REQUEST_BODY_SIZE,

  async fetch(req) {
    try {
      const url = new URL(req.url)
      const { pathname } = url
      const corsHeaders = getCorsHeaders(req)
      const corsResponse = corsMiddleware(req, corsHeaders)
      if (corsResponse) return withSecurityHeaders(corsResponse)

      const method = req.method
      const isUnsafeMethod = !['GET', 'HEAD', 'OPTIONS'].includes(method)
      if (isUnsafeMethod && !isAllowedOrigin(req)) {
        return withSecurityHeaders(errorResponse('Forbidden origin', 403, corsHeaders))
      }

      const routeCtx = { method, pathname, searchParams: url.searchParams }
  const routes = [
    healthRoutes,
    authRoutes,
    accountsRoutes,
    settingsRoutes,
    meetingsRoutes,
    subscriptionsRoutes,
    caldavRoutes
  ]
      for (const route of routes) {
        const response = await route(req, routeCtx)
        if (response) return withSecurityHeaders(response)
      }

      if (method === 'GET') {
        return withSecurityHeaders(await staticFileHandler(pathname))
      }

      return withSecurityHeaders(errorResponse('接口不存在', 404, corsHeaders))
    } catch (err) {
      console.error('❌ 服务器错误:', err)
      const detail = process.env.NODE_ENV === 'development' ? String(err) : undefined
      const corsHeaders = getCorsHeaders(req)
      return withSecurityHeaders(jsonResponse({ error: '服务器内部错误', detail }, 500, corsHeaders))
    }
  }
})
