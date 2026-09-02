import { CONFIG } from '../config/index.js'
import { getCorsHeaders } from '../middleware/cors.js'
import { jsonResponse, errorResponse } from '../utils/response.js'
import {
  login,
  logout,
  changePassword,
  verifyCurrentPassword
} from '../services/auth.service.js'
import { parseCookies } from '../middleware/auth.js'
import {
  clearLoginAttempts,
  isLoginRateLimited,
  recordFailedLogin
} from '../utils/rate-limit.js'
import { loginSchema, changePasswordSchema } from '../validators/auth.validator.js'

const isProduction = process.env.NODE_ENV === 'production'
const secureFlag = isProduction ? '; Secure' : ''
const LOGIN_RATE_LIMIT_KEY = 'login'

function sessionCookie(token) {
  return `session=${token}; HttpOnly; Path=/; Max-Age=${CONFIG.SESSION_DURATION / 1000}; SameSite=Lax${secureFlag}`
}

function clearedSessionCookie() {
  return `session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${secureFlag}`
}

export const authController = {
  async login(req) {
    const corsHeaders = getCorsHeaders(req)
    if (isLoginRateLimited(LOGIN_RATE_LIMIT_KEY)) {
      return errorResponse('尝试次数过多，请稍后再试', 429, corsHeaders)
    }

    const body = await req.json().catch(() => ({}))
    const result = loginSchema.safeParse(body)
    if (!result.success) {
      return errorResponse(result.error.issues[0].message, 400, corsHeaders)
    }

    const authResult = await login(result.data.password)
    if (!authResult) {
      recordFailedLogin(LOGIN_RATE_LIMIT_KEY)
      return errorResponse('密码错误', 401, corsHeaders)
    }

    clearLoginAttempts(LOGIN_RATE_LIMIT_KEY)
    return jsonResponse(
      { ok: true, mustChangePassword: authResult.mustChangePassword },
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
    const body = await req.json().catch(() => ({}))
    const result = changePasswordSchema.safeParse(body)
    if (!result.success) {
      return errorResponse(result.error.issues[0].message, 400, corsHeaders)
    }

    const { oldPassword, newPassword } = result.data
    const isValid = await verifyCurrentPassword(oldPassword)
    if (!isValid) {
      return errorResponse('当前密码错误', 401, corsHeaders)
    }

    const cookies = parseCookies(req.headers.get('cookie') || '')
    const currentToken = cookies['session'] || null
    const sessionInfo = await changePassword(newPassword, currentToken)

    return jsonResponse(
      { ok: true },
      200,
      corsHeaders,
      { 'Set-Cookie': sessionCookie(sessionInfo.token) }
    )
  }
}
