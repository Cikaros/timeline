import { resolve } from 'node:path'
import { CONFIG } from './config/index.js'
import { corsMiddleware, getCorsHeaders } from './middleware/cors.js'
import { authRoutes } from './routes/auth.js'
import { settingsRoutes } from './routes/settings.js'
import { meetingsRoutes } from './routes/meetings.js'
import { jsonResponse, errorResponse } from './utils/response.js'
import { initializeDefaultPassword } from './services/auth.service.js'
import { startScheduledTasks } from './utils/tasks.js'

const STATIC_ROOT = resolve(import.meta.dirname, '../dist')

// 安全响应头：统一注入所有响应
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '0',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
}

function withSecurityHeaders(response) {
  const headers = new Headers(response.headers)
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(key, value)
  }
  // 生产环境添加 HSTS
  if (process.env.NODE_ENV === 'production') {
    headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  })
}

// 静态文件服务（仅生产环境）
async function staticFileHandler(pathname) {
  if (process.env.NODE_ENV !== 'production') {
    return new Response('开发模式下请访问前端开发服务器：http://localhost:5174', {
      status: 404,
      headers: { 'Content-Type': 'text/plain' }
    })
  }

  const relativePath = pathname === '/' ? '/index.html' : pathname
  const filePath = resolve(STATIC_ROOT, '.' + relativePath)

  // 防止路径遍历：确保解析后的路径在静态文件目录内
  if (!filePath.startsWith(STATIC_ROOT + '/')) {
    return errorResponse('Forbidden', 403)
  }

  try {
    const file = Bun.file(filePath)
    if (!await file.exists()) {
      return new Response(Bun.file(resolve(STATIC_ROOT, 'index.html')), {
        headers: { 'Content-Type': 'text/html' }
      })
    }

    const headers = {
      'Content-Type': file.type,
      'Cache-Control': `public, max-age=${CONFIG.STATIC_CACHE_MAX_AGE}, immutable`
    }

    if (filePath.endsWith('.html')) {
      headers['Cache-Control'] = 'no-cache'
    }

    return new Response(file, { headers })
  } catch (e) {
    return errorResponse('Not Found', 404)
  }
}

// 初始化
await initializeDefaultPassword()
startScheduledTasks()

// 启动服务
console.log(`🚀 后端服务已启动：http://localhost:${CONFIG.PORT}`)
console.log(`📁 数据库文件：${CONFIG.DB_PATH}`)
console.log(`🌍 开发环境前端地址：http://localhost:5174`)

export default Bun.serve({
  port: CONFIG.PORT,
  maxRequestBodySize: CONFIG.MAX_REQUEST_BODY_SIZE,

  async fetch(req) {
    try {
      // 解析 URL 一次，供所有路由和中间件共享
      const url = new URL(req.url)
      const { pathname } = url

      // 处理CORS预检
      const corsHeaders = getCorsHeaders(req)
      const corsResponse = corsMiddleware(req, corsHeaders)
      if (corsResponse) return withSecurityHeaders(corsResponse)

      // 按模块匹配路由（统一传递 req + method + pathname）
      const method = req.method
      const routeCtx = { method, pathname, searchParams: url.searchParams }
      const routes = [authRoutes, settingsRoutes, meetingsRoutes]
      for (const route of routes) {
        const response = await route(req, routeCtx)
        if (response) return withSecurityHeaders(response)
      }

      // 静态文件服务
      if (method === 'GET') {
        return withSecurityHeaders(await staticFileHandler(pathname))
      }

      // 404
      return withSecurityHeaders(errorResponse('接口不存在', 404, corsHeaders))

    } catch (err) {
      console.error('❌ 服务器错误:', err)
      const detail = process.env.NODE_ENV === 'development' ? String(err) : undefined
      const corsHeaders = getCorsHeaders(req)
      return withSecurityHeaders(jsonResponse({ error: '服务器内部错误', detail }, 500, corsHeaders))
    }
  }
})