import { meetingsController } from '../controllers/meetings.controller.js'
import { requireAuth } from '../middleware/auth.js'
import { errorResponse } from '../utils/response.js'
import { getCorsHeaders } from '../middleware/cors.js'

export function meetingsRoutes(req) {
  const url = new URL(req.url)
  const path = url.pathname

  if (path === '/api/meetings') {
    if (req.method === 'GET') {
      if (!requireAuth(req)) {
        return errorResponse('未授权', 401, getCorsHeaders(req))
      }
      return meetingsController.getMeetings(req)
    }

    if (req.method === 'POST') {
      if (!requireAuth(req)) {
        return errorResponse('未授权', 401, getCorsHeaders(req))
      }
      return meetingsController.insertMeetings(req)
    }
  }

  if (path === '/api/meetings/clear' && req.method === 'POST') {
    if (!requireAuth(req)) {
      return errorResponse('未授权', 401, getCorsHeaders(req))
    }
    return meetingsController.clearAll(req)
  }

  // 单个会议操作
  const meetingMatch = path.match(/^\/api\/meetings\/(\d+)$/)
  if (meetingMatch) {
    const id = Number(meetingMatch[1])
    if (isNaN(id)) {
      return errorResponse('无效的会议ID', 400, getCorsHeaders(req))
    }

    if (req.method === 'POST') {
      if (!requireAuth(req)) {
        return errorResponse('未授权', 401, getCorsHeaders(req))
      }
      return meetingsController.updateNote(req, id)
    }

    if (req.method === 'DELETE') {
      if (!requireAuth(req)) {
        return errorResponse('未授权', 401, getCorsHeaders(req))
      }
      return meetingsController.deleteMeeting(req, id)
    }
  }

  return null
}