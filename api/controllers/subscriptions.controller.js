import { getCorsHeaders } from '../middleware/cors.js'
import { getCurrentUser } from '../middleware/auth.js'
import { jsonResponse, errorResponse } from '../utils/response.js'
import {
  getSubscriptions,
  createSubscription,
  updateSubscription,
  deleteSubscription,
  touchSubscription
} from '../services/subscriptions.service.js'
import { getIcsContent } from '../services/ics.service.js'
import {
  createSubscriptionSchema,
  updateSubscriptionSchema
} from '../validators/subscriptions.validator.js'

export const subscriptionsController = {
  list(req) {
    const user = getCurrentUser(req)
    return jsonResponse(
      { subscriptions: getSubscriptions({ userId: user?.userId }) },
      200,
      getCorsHeaders(req)
    )
  },

  async create(req) {
    const corsHeaders = getCorsHeaders(req)
    const body = await req.json().catch(() => ({}))
    const result = createSubscriptionSchema.safeParse(body)
    if (!result.success) {
      return errorResponse(result.error.issues[0].message, 400, corsHeaders)
    }

    try {
      const subscription = createSubscription(result.data.name, getCurrentUser(req)?.userId)
      return jsonResponse({ subscription }, 201, corsHeaders)
    } catch (err) {
      return errorResponse(err.message || '创建订阅链接失败', 400, corsHeaders)
    }
  },

  async update(req, id) {
    const corsHeaders = getCorsHeaders(req)
    const body = await req.json().catch(() => ({}))
    const result = updateSubscriptionSchema.safeParse(body)
    if (!result.success) {
      return errorResponse(result.error.issues[0].message, 400, corsHeaders)
    }

    const subscription = updateSubscription(id, result.data)
    if (!subscription) {
      return errorResponse('订阅不存在', 404, corsHeaders)
    }
    return jsonResponse({ subscription }, 200, corsHeaders)
  },

  remove(req, id) {
    const corsHeaders = getCorsHeaders(req)
    const deleted = deleteSubscription(id)
    if (!deleted) {
      return errorResponse('订阅不存在', 404, corsHeaders)
    }
    return new Response(null, { status: 204, headers: corsHeaders })
  },

  async getIcs(req, token) {
    const corsHeaders = getCorsHeaders(req)
    const result = await getIcsContent(token)
    if (!result) {
      return errorResponse('订阅不存在或已停用', 404, corsHeaders)
    }

    touchSubscription(result.subscription.id)
    return new Response(result.content, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="timeline.ics"',
        'Cache-Control': 'no-store'
      }
    })
  }
}
