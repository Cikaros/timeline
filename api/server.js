import { CONFIG } from './config/index.js'
import { corsMiddleware, getCorsHeaders } from './middleware/cors.js'
import { authRoutes } from './routes/auth.js'
import { settingsRoutes } from './routes/settings.js'
import { meetingsRoutes } from './routes/meetings.js'
import { jsonResponse, errorResponse } from './utils/response.js'
import { initializeDefaultPassword } from './services/auth.service.js'
import { startScheduledTasks } from './utils/tasks.js'

// 静态文件服务（仅生产环境）
async function staticFileHandler(req) {
  if (process.env.NODE_ENV !== 'production') {
    return new Response('开发模式下请访问前端开发服务器：http://localhost:5173', {
      status: 404,
      headers: { 'Content-Type': 'text/plain' }
    })
  }

  const url = new URL(req.url)
  const path = url.pathname
  const filePath = '../dist' + (path === '/' ? '/index.html' : path)

  try {
    const file = Bun.file(filePath)
    if (!await file.exists()) {
      return new Response(Bun.file('../dist/index.html'), {
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
    return errorResponse('Not Found', 404, getCorsHeaders(req))
  }
}

// 初始化
await initializeDefaultPassword()
startScheduledTasks()

// 启动服务
console.log(`🚀 后端服务已启动：http://localhost:${CONFIG.PORT}`)
console.log(`📁 数据库文件：${CONFIG.DB_PATH}`)
console.log(`🌍 开发环境前端地址：http://localhost:5173`)

export default Bun.serve({
  port: CONFIG.PORT,
  maxRequestBodySize: CONFIG.MAX_REQUEST_BODY_SIZE,

  async fetch(req) {
    try {
      // 处理CORS预检
      const corsResponse = corsMiddleware(req)
      if (corsResponse) return corsResponse

      // 按模块匹配路由
      const routes = [authRoutes, settingsRoutes, meetingsRoutes]
      for (const route of routes) {
        const response = await route(req)
        if (response) return response
      }

      // 静态文件服务
      if (req.method === 'GET') {
        return staticFileHandler(req)
      }

      // 404
      return errorResponse('接口不存在', 404, getCorsHeaders(req))

    } catch (err) {
      console.error('❌ 服务器错误:', err)
      const detail = process.env.NODE_ENV === 'development' ? String(err) : undefined
      return jsonResponse({ error: '服务器内部错误', detail }, 500, getCorsHeaders(req))
    }
  }
})