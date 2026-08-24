import { meetingsController } from '../controllers/meetings.controller.js'
import { withAuth } from '../middleware/auth.js'

export function meetingsRoutes(req, { method, pathname, searchParams }) {
  if (pathname === '/api/meetings') {
    if (method === 'GET') {
      return withAuth(meetingsController.getMeetings)(req, searchParams)
    }

    if (method === 'POST') {
      return withAuth(meetingsController.insertMeetings)(req)
    }
  }

  // 单个会议操作
  const meetingMatch = pathname.match(/^\/api\/meetings\/(\d+)$/)
  if (meetingMatch) {
    const id = Number(meetingMatch[1])
    if (isNaN(id) || id <= 0) return null

    if (method === 'POST') {
      return withAuth(meetingsController.updateNote)(req, id)
    }

    if (method === 'DELETE') {
      return withAuth(meetingsController.deleteMeeting)(req, id)
    }
  }

  return null
}
