import { getCorsHeaders } from '../middleware/cors.js'
import { jsonResponse, errorResponse } from '../utils/response.js'
import {
  getMeetings,
  insertMeetings,
  updateMeetingNote,
  deleteMeeting,
  clearAllMeetings
} from '../services/meetings.service.js'

export const meetingsController = {
  getMeetings(req) {
    const corsHeaders = getCorsHeaders(req)
    const url = new URL(req.url)
    const limit = Math.min(Number(url.searchParams.get('limit')) || 1000, 10000)
    const offset = Number(url.searchParams.get('offset')) || 0

    const result = getMeetings(limit, offset)
    return jsonResponse(result, 200, corsHeaders)
  },

  async insertMeetings(req) {
    const corsHeaders = getCorsHeaders(req)
    const body = await req.json().catch(() => ({}))
    const input = body.input || body.date || ''
    const note = body.note?.trim() || ''

    const result = insertMeetings(input, note)
    if (result.inserted.length === 0 && result.skipped.length === 0) {
      return errorResponse('未解析到有效日期', 400, corsHeaders)
    }

    return jsonResponse(result, 200, corsHeaders)
  },

  async updateNote(req, id) {
    const corsHeaders = getCorsHeaders(req)
    const body = await req.json().catch(() => ({}))
    const note = body.note?.trim() || ''

    updateMeetingNote(id, note)
    return jsonResponse({ ok: true }, 200, corsHeaders)
  },

  deleteMeeting(req, id) {
    const corsHeaders = getCorsHeaders(req)
    deleteMeeting(id)
    return new Response(null, { status: 204, headers: corsHeaders })
  },

  clearAll(req) {
    const corsHeaders = getCorsHeaders(req)
    clearAllMeetings()
    return jsonResponse({ ok: true }, 200, corsHeaders)
  }
}