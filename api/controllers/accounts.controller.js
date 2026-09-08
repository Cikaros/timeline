import { getCorsHeaders } from '../middleware/cors.js'
import { jsonResponse, errorResponse } from '../utils/response.js'
import { getCurrentUser } from '../middleware/auth.js'
import {
  getAccounts,
  getAccountById,
  createAccount,
  deleteAccount
} from '../services/users.service.js'
import { createAccountSchema } from '../validators/accounts.validator.js'

export const accountsController = {
  list(req) {
    return jsonResponse(
      { accounts: getAccounts(), maxAccounts: 2 },
      200,
      getCorsHeaders(req)
    )
  },

  async create(req) {
    const corsHeaders = getCorsHeaders(req)
    const body = await req.json().catch(() => ({}))
    const result = createAccountSchema.safeParse(body)
    if (!result.success) {
      return errorResponse(result.error.issues[0].message, 400, corsHeaders)
    }

    try {
      const account = await createAccount(result.data.username, result.data.password)
      return jsonResponse({ account }, 201, corsHeaders)
    } catch (err) {
      return errorResponse(err.message || '创建账号失败', 400, corsHeaders)
    }
  },

  remove(req, id) {
    const corsHeaders = getCorsHeaders(req)
    const auth = getCurrentUser(req)
    if (!auth) return errorResponse('未授权', 401, corsHeaders)

    const isSelf = auth.userId === id
    try {
      const deleted = deleteAccount(id)
      if (!deleted) {
        return errorResponse('账号不存在', 404, corsHeaders)
      }

      if (!isSelf) {
        return jsonResponse({ ok: true }, 200, corsHeaders)
      }

      return jsonResponse(
        { ok: true, deletedSelf: true },
        200,
        corsHeaders,
        { 'Set-Cookie': 'session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax' }
      )
    } catch (err) {
      return errorResponse(err.message || '删除账号失败', 400, corsHeaders)
    }
  },

  show(req, id) {
    const account = getAccountById(id)
    if (!account) {
      return errorResponse('账号不存在', 404, getCorsHeaders(req))
    }
    return jsonResponse({ account }, 200, getCorsHeaders(req))
  }
}
