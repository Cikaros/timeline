import { getCorsHeaders } from '../middleware/cors.js'
import { jsonResponse, errorResponse } from '../utils/response.js'
import { parsePagination } from '../utils/pagination.js'
import {
  getMeetings,
  insertMeetings,
  updateMeetingNote,
  deleteMeeting
} from '../services/meetings.service.js'
import { createMeetingsSchema, updateNoteSchema } from '../validators/meetings.validator.js'

export const meetingsController = {
  getMeetings(req, searchParams) {
    const corsHeaders = getCorsHeaders(req)
    const { limit, offset } = parsePagination(searchParams)
    const result = getMeetings(limit, offset)
    return jsonResponse(result, 200, corsHeaders)
  },

  async insertMeetings(req) {
    const corsHeaders = getCorsHeaders(req)
    const body = await req.json().catch(() => ({}))
    const result = createMeetingsSchema.safeParse(body)
    if (!result.success) {
      return errorResponse(result.error.issues[0].message, 400, corsHeaders)
    }

    const { input, date, note } = result.data
    const payload = input || date || ''
    const insertResult = insertMeetings(payload, note?.trim() || '')
    if (insertResult.inserted.length === 0 && insertResult.skipped.length === 0) {
      return errorResponse('未解析到有效日期', 400, corsHeaders)
    }

    return jsonResponse(insertResult, 200, corsHeaders)
  },

  async updateNote(req, id) {
    const corsHeaders = getCorsHeaders(req)
    const body = await req.json().catch(() => ({}))
    const result = updateNoteSchema.safeParse(body)
    if (!result.success) {
      return errorResponse(result.error.issues[0].message, 400, corsHeaders)
    }

    const changes = updateMeetingNote(id, result.data.note)
    if (changes === 0) {
      return errorResponse('记录不存在', 404, corsHeaders)
    }
    return jsonResponse({ ok: true }, 200, corsHeaders)
  },

  deleteMeeting(req, id) {
    const corsHeaders = getCorsHeaders(req)
    const changes = deleteMeeting(id)
    if (changes === 0) {
      return errorResponse('记录不存在', 404, corsHeaders)
    }
    return new Response(null, { status: 204, headers: corsHeaders })
  }
}
