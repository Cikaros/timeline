import { getCorsHeaders } from '../middleware/cors.js'
import { getCurrentUser } from '../middleware/auth.js'
import { jsonResponse, errorResponse } from '../utils/response.js'
import { getSettings, setFirstMeeting } from '../services/settings.service.js'
import { setFirstMeetingSchema } from '../validators/settings.validator.js'

export const settingsController = {
  getSettings(req) {
    const corsHeaders = getCorsHeaders(req)
    const settings = getSettings()
    const user = getCurrentUser(req)
    return jsonResponse(
      { ...settings, current_user: user ? { id: user.userId, username: user.username } : null },
      200,
      corsHeaders
    )
  },

  async setFirstMeeting(req) {
    const corsHeaders = getCorsHeaders(req)
    const body = await req.json().catch(() => ({}))
    const result = setFirstMeetingSchema.safeParse(body)
    if (!result.success) {
      return errorResponse(result.error.issues[0].message, 400, corsHeaders)
    }

    const date = setFirstMeeting(result.data.date)
    if (!date) {
      return errorResponse('无效的日期格式', 400, corsHeaders)
    }

    return jsonResponse({ ok: true, date }, 200, corsHeaders)
  }
}
