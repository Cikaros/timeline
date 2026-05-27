import { getCorsHeaders } from '../middleware/cors.js'
import { jsonResponse, errorResponse } from '../utils/response.js'
import { getSettings, setFirstMeeting } from '../services/settings.service.js'

export const settingsController = {
  getSettings(req) {
    const corsHeaders = getCorsHeaders(req)
    const settings = getSettings()
    return jsonResponse(settings, 200, corsHeaders)
  },

  async setFirstMeeting(req) {
    const corsHeaders = getCorsHeaders(req)
    const body = await req.json().catch(() => ({}))
    const date = setFirstMeeting(body.date)

    if (!date) {
      return errorResponse('无效的日期格式', 400, corsHeaders)
    }

    return jsonResponse({ ok: true, date }, 200, corsHeaders)
  }
}