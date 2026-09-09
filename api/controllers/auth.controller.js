import { CONFIG } from '../config/index.js'
import { getCorsHeaders } from '../middleware/cors.js'
import { jsonResponse, errorResponse } from '../utils/response.js'
import {
  login,
  logout,
  changeCurrentUserPassword
} from '../services/users.service.js'
import { parseCookies, getCurrentUser } from '../middleware/auth.js'
import {
  clearLoginAttempts,
  isLoginRateLimited,
  recordFailedLogin
} from '../utils/rate-limit.js'
import { loginSchema, changePasswordSchema } from '../validators/auth.validator.js'

const isProduction = process.env.NODE_ENV === 'production'
const secureFlag = isProduction ? '; Secure' : ''

function sessionCookie(token) {
  return `session=${token}; HttpOnly; Path=/; Max-Age=${CONFIG.SESSION_DURATION / 1000}; SameSite=Lax${secureFlag}`
}

function clearedSessionCookie() {
  return `session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${secureFlag}`
}

export const authController = {
  async login(req) {
    const corsHeaders = getCorsHeaders(req)
    const body = await req.json().catch(() => ({}))
    const result = loginSchema.safeParse(body)
    if (!result.success) {
      return errorResponse(result.error.issues[0].message, 400, corsHeaders)
    }

    const rateLimitKey = result.data.username
    if (isLoginRateLimited(rateLimitKey)) {
      return errorResponse('尝试次数过多，请稍后再试', 429, corsHeaders)
    }

    const authResult = await login(result.data.username, result.data.password)
    if (!authResult) {
      recordFailedLogin(rateLimitKey)
      return errorResponse('用户名或密码错误', 401, corsHeaders)
    }

    clearLoginAttempts(rateLimitKey)
    return jsonResponse(
      {
        ok: true,
        user: authResult.user,
        mustChangePassword: authResult.mustChangePassword
      },
      200,
      corsHeaders,
      { 'Set-Cookie': sessionCookie(authResult.token) }
    )
  },

  async logout(req) {
    const corsHeaders = getCorsHeaders(req)
    const cookies = parseCookies(req.headers.get('cookie') || '')
    logout(cookies['session'])

    return jsonResponse(
      { ok: true },
      200,
      corsHeaders,
      { 'Set-Cookie': clearedSessionCookie() }
    )
  },

  async changePassword(req) {
    const corsHeaders = getCorsHeaders(req)
    const cookies = parseCookies(req.headers.get('cookie') || '')
    const body = await req.json().catch(() => ({}))
    const result = changePasswordSchema.safeParse(body)
    if (!result.success) {
      return errorResponse(result.error.issues[0].message, 400, corsHeaders)
    }

    const auth = getCurrentUser(req)
    if (!auth) return errorResponse('未授权', 401, corsHeaders)

    const { currentPassword, newPassword } = result.data
    const sessionInfo = await changeCurrentUserPassword(
      auth.userId,
      currentPassword,
      newPassword,
      cookies['session'] || null
    )
    if (!sessionInfo) {
      return errorResponse('当前密码错误', 401, corsHeaders)
    }

    return jsonResponse(
      { ok: true, user: sessionInfo.user },
      200,
      corsHeaders,
      { 'Set-Cookie': sessionCookie(sessionInfo.token) }
    )
  }
}
