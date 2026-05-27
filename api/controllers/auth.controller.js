import { CONFIG } from '../config/index.js'
import { getCorsHeaders } from '../middleware/cors.js'
import { jsonResponse, errorResponse } from '../utils/response.js'
import { login, logout, changePassword } from '../services/auth.service.js'
import { parseCookies } from '../middleware/auth.js'

export const authController = {
  async login(req) {
    const corsHeaders = getCorsHeaders(req)
    const body = await req.json().catch(() => ({}))
    const password = body.password || ''

    const result = await login(password)
    if (!result) {
      return errorResponse('密码错误', 401, corsHeaders)
    }

    const cookie = `session=${result.token}; HttpOnly; Path=/; Max-Age=${CONFIG.SESSION_DURATION / 1000}; SameSite=Lax`
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': cookie,
        ...corsHeaders
      }
    })
  },

  async logout(req) {
    const corsHeaders = getCorsHeaders(req)
    const cookies = parseCookies(req.headers.get('cookie') || '')
    logout(cookies['session'])

    const cookie = 'session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax'
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': cookie,
        ...corsHeaders
      }
    })
  },

  async changePassword(req) {
    const corsHeaders = getCorsHeaders(req)
    const body = await req.json().catch(() => ({}))
    const newPassword = body.newPassword?.trim()

    if (!newPassword) {
      return errorResponse('新密码不能为空', 400, corsHeaders)
    }

    await changePassword(newPassword)
    return jsonResponse({ ok: true }, 200, corsHeaders)
  }
}