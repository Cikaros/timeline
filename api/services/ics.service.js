import { db, preparedStatements } from '../db/index.js'
import { getSubscriptions } from './subscriptions.service.js'

const MAX_FUTURE_YEARS = 1

function pad2(value) {
  return String(value).padStart(2, '0')
}

function formatIcsDate(date) {
  return `${date.getUTCFullYear()}${pad2(date.getUTCMonth() + 1)}${pad2(date.getUTCDate())}`
}

function formatIcsTimestamp(date) {
  return `${formatIcsDate(date)}T${pad2(date.getUTCHours())}${pad2(date.getUTCMinutes())}${pad2(date.getUTCSeconds())}Z`
}

function parseUtcDate(dateString) {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

function addDays(date, days) {
  const result = new Date(date.getTime())
  result.setUTCDate(result.getUTCDate() + days)
  return result
}

function escapeIcsText(value) {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll(';', '\\;')
    .replaceAll(',', '\\,')
    .replaceAll('\r\n', '\\n')
    .replaceAll('\r', '\\n')
    .replaceAll('\n', '\\n')
}

function byteLength(value) {
  return new TextEncoder().encode(value).length
}

function foldIcsLine(line) {
  if (byteLength(line) <= 75) return [line]

  const lines = []
  let current = ''
  let currentLength = 0
  let limit = 75

  for (const char of line) {
    const length = byteLength(char)
    if (currentLength + length > limit) {
      lines.push(current)
      current = ` ${char}`
      currentLength = 1 + length
      limit = 75
      continue
    }

    current += char
    currentLength += length
  }

  if (current) lines.push(current)
  return lines
}

function groupIcsMeetings(meetings) {
  const groups = []

  for (const meeting of meetings) {
    const key = meeting.uid || `meeting-${meeting.id}`
    const last = groups[groups.length - 1]
    if (last && last.uid && meeting.uid && last.uid === meeting.uid) {
      last.end_date = meeting.date
      last.ids.push(meeting.id)
      last.updated_at = Math.max(last.updated_at || 0, meeting.updated_at || 0)
      continue
    }

    groups.push({
      id: meeting.id,
      uid: meeting.uid || null,
      date: meeting.date,
      end_date: meeting.date,
      note: meeting.note,
      updated_at: meeting.updated_at,
      ids: [meeting.id]
    })
  }

  return groups
}

function buildIcs(meetings, now = new Date()) {
  const maximumDate = new Date(
    Date.UTC(now.getUTCFullYear() + MAX_FUTURE_YEARS, now.getUTCMonth(), now.getUTCDate())
  )
  const dtstamp = formatIcsTimestamp(now)
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Timeline//Calendar 1.0//CN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Timeline'
  ]

  for (const meeting of groupIcsMeetings(meetings)) {
    const start = parseUtcDate(meeting.date.split('T')[0])
    const end = parseUtcDate(meeting.end_date.split('T')[0])
    if (start > maximumDate) continue

    const note = meeting.note ? meeting.note.trim() : ''
    const summary = note ? `见面：${note}` : '见面'
    lines.push(
      'BEGIN:VEVENT',
      `UID:${meeting.uid || `${meeting.id}@timeline`}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${formatIcsDate(start)}`,
      `DTEND;VALUE=DATE:${formatIcsDate(addDays(end, 1))}`,
      `SUMMARY:${escapeIcsText(summary)}`,
      'STATUS:CONFIRMED',
      'TRANSP:TRANSPARENT',
      'END:VEVENT'
    )
  }

  lines.push('END:VCALENDAR')
  return lines.flatMap(foldIcsLine).join('\r\n') + '\r\n'
}

/**
 * 生成订阅源的 ICS 内容
 */
export async function getIcsContent(token, dependencies = {}) {
  const { db: database = db, prepared } = dependencies
  const statements = prepared || preparedStatements
  const subscription = statements.getCalendarSubscriptionByToken.get(token)
  if (!subscription || !subscription.enabled) return null

  const maximumDate = `${new Date().getUTCFullYear() + MAX_FUTURE_YEARS}-${pad2(
    new Date().getUTCMonth() + 1
  )}-${pad2(new Date().getUTCDate())}`
  const meetings = statements.getIcsMeetings.all(maximumDate)

  return {
    subscription,
    content: buildIcs(meetings)
  }
}

/**
 * 供测试和其他调用方复用
 */
export function listSubscriptionTokens(dependencies = {}) {
  return getSubscriptions(dependencies)
}

export {
  buildIcs,
  foldIcsLine,
  groupIcsMeetings,
  formatIcsDate,
  parseUtcDate,
  addDays,
  escapeIcsText
}
