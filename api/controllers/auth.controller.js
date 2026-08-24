import { CONFIG } from '../config/index.js'
import { getCorsHeaders } from '../middleware/cors.js'
import { jsonResponse, errorResponse } from '../utils/response.js'
import { login, logout, changePassword, verifyCurrentPassword } from '../services/auth.service.js'
import { parseCookies } from '../middleware/auth.js'
import { loginSchema, changePasswordSchema } from '../validators/auth.validator.js'

const isProduction = process.env.NODE_ENV === 'production'
const secureFlag = isProduction ? '; Secure' : ''

export const authController = {
  async login(req) {
    const corsHeaders = getCorsHeaders(req)
    const body = await req.json().catch(() => ({}))
    const result = loginSchema.safeParse(body)
    if (!result.success) {
      return errorResponse(result.error.issues[0].message, 400, corsHeaders)
    }

    const authResult = await login(result.data.password)
    if (!authResult) {
      return errorResponse('密码错误', 401, corsHeaders)
    }

    const cookie = `session=${authResult.token}; HttpOnly; Path=/; Max-Age=${CONFIG.SESSION_DURATION / 1000}; SameSite=Lax${secureFlag}`
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

    const cookie = `session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${secureFlag}`
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
    const result = changePasswordSchema.safeParse(body)
    if (!result.success) {
      return errorResponse(result.error.issues[0].message, 400, corsHeaders)
    }

    const { oldPassword, newPassword } = result.data

    // 验证当前密码
    const isValid = await verifyCurrentPassword(oldPassword)
    if (!isValid) {
      return errorResponse('当前密码错误', 401, corsHeaders)
    }

    // 获取当前会话 token
    const cookies = parseCookies(req.headers.get('cookie') || '')
    const currentToken = cookies['session'] || null

    const sessionInfo = await changePassword(newPassword, currentToken)

    // 设置新会话 cookie
    const cookie = `session=${sessionInfo.token}; HttpOnly; Path=/; Max-Age=${CONFIG.SESSION_DURATION / 1000}; SameSite=Lax${secureFlag}`
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': cookie,
        ...corsHeaders
      }
    })
  }
}
