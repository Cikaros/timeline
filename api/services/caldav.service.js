import { db, preparedStatements } from '../db/index.js'
import {
  buildIcs,
  addDays,
  escapeIcsText,
  foldIcsLine,
  formatIcsDate,
  parseUtcDate
} from './ics.service.js'
import { hashSessionToken } from '../utils/crypto.js'
import { verifyPassword } from '../utils/crypto.js'

const MAX_EVENT_DAYS = 366

function normalizePath(pathname) {
  return pathname.replace(/\/+$/, '') || '/caldav'
}

function xmlEscape(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function groupEvents(rows) {
  const groups = []
  const byUid = new Map()

  for (const row of rows) {
    const key = row.uid || `meeting-${row.id}`
    const existing = row.uid ? byUid.get(row.uid) : null

    if (existing) {
      existing.end_date = row.date
      existing.ids.push(row.id)
      existing.updated_at = Math.max(existing.updated_at, row.updated_at || 0)
      continue
    }

    const group = {
      id: row.id,
      uid: row.uid || null,
      date: row.date,
      end_date: row.date,
      note: row.note,
      updated_at: row.updated_at || 0,
      ids: [row.id]
    }
    groups.push(group)
    if (row.uid) byUid.set(row.uid, group)
  }

  return groups
}

function eventUid(group) {
  return group.uid || `${group.id}@timeline`
}

function eventEtag(group) {
  const hash = hashSessionToken(
    [
      group.ids.join(':'),
      group.date,
      group.end_date,
      group.note || '',
      group.updated_at || 0
    ].join('|')
  )
  return `"${hash.slice(0, 32)}"`
}

function eventHref(username, group) {
  const uid = encodeURIComponent(eventUid(group))
  return `/caldav/calendars/${encodeURIComponent(username)}/${uid}.ics`
}

function buildEvent(group) {
  const start = parseUtcDate(group.date.split('T')[0])
  const end = parseUtcDate(group.end_date.split('T')[0])
  const note = group.note ? group.note.trim() : ''
  const summary = note ? `见面：${note}` : '见面'
  const event = [
    'BEGIN:VEVENT',
    `UID:${eventUid(group)}`,
    `DTSTAMP:${formatIcsDate(new Date())}T000000Z`,
    `DTSTART;VALUE=DATE:${formatIcsDate(start)}`,
    `DTEND;VALUE=DATE:${formatIcsDate(addDays(end, 1))}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    'STATUS:CONFIRMED',
    'TRANSP:TRANSPARENT',
    'END:VEVENT'
  ]

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Timeline//Calendar 1.0//CN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Timeline',
    ...event,
    'END:VCALENDAR'
  ].flatMap(foldIcsLine).join('\r\n') + '\r\n'
}

function multistatus(responses, syncToken = null) {
  const body = `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav" xmlns:CS="http://calendarserver.org/ns/">
${responses.join('\n')}${syncToken ? `\n<D:sync-token>${xmlEscape(syncToken)}</D:sync-token>` : ''}
</D:multistatus>`
  return new Response(body, {
    status: 207,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'DAV': '1, 2, calendar-access'
    }
  })
}

function eventResponse(username, group) {
  return `  <D:response>
    <D:href>${xmlEscape(eventHref(username, group))}</D:href>
    <D:propstat>
      <D:prop>
        <D:getetag>${xmlEscape(eventEtag(group))}</D:getetag>
        <C:calendar-data>${xmlEscape(buildEvent(group))}</C:calendar-data>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>`
}

function principalResponse(username) {
  const principalHref = `/caldav/principal/${encodeURIComponent(username)}/`

  return `  <D:response>
    <D:href>/caldav/</D:href>
    <D:propstat>
      <D:prop>
        <D:principal-URL><D:href>${xmlEscape(principalHref)}</D:href></D:principal-URL>
        <D:current-user-principal>
          <D:href>${xmlEscape(principalHref)}</D:href>
        </D:current-user-principal>
        <D:resourcetype><D:principal/></D:resourcetype>
        <D:display-name>${xmlEscape(username)}</D:display-name>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>`
}

function homeResponse(username) {
  const principalHref = `/caldav/principal/${encodeURIComponent(username)}/`

  return `  <D:response>
    <D:href>${xmlEscape(principalHref)}</D:href>
    <D:propstat>
      <D:prop>
        <D:principal-URL><D:href>${xmlEscape(principalHref)}</D:href></D:principal-URL>
        <D:current-user-principal>
          <D:href>${xmlEscape(principalHref)}</D:href>
        </D:current-user-principal>
        <D:resourcetype><D:principal/></D:resourcetype>
        <D:display-name>${xmlEscape(username)}</D:display-name>
        <C:calendar-home-set>
          <D:href>/caldav/calendars/${encodeURIComponent(username)}/</D:href>
        </C:calendar-home-set>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>`
}

function collectionResponse(username, includeEvents, rows) {
  const principalHref = `/caldav/principal/${encodeURIComponent(username)}/`
  const groups = groupEvents(rows)
  const eventResponses = includeEvents
    ? groups.map(group => eventResponse(username, group))
    : []

  return [
    `  <D:response>
    <D:href>/caldav/calendars/${encodeURIComponent(username)}/</D:href>
    <D:propstat>
      <D:prop>
        <D:display-name>Timeline</D:display-name>
        <D:current-user-principal>
          <D:href>${xmlEscape(principalHref)}</D:href>
        </D:current-user-principal>
        <D:principal-URL><D:href>${xmlEscape(principalHref)}</D:href></D:principal-URL>
        <D:owner><D:href>${xmlEscape(principalHref)}</D:href></D:owner>
        <D:resourcetype><D:collection/><C:calendar/></D:resourcetype>
        <C:supported-calendar-component-set><C:comp name="VEVENT"/></C:supported-calendar-component-set>
        <D:current-user-privilege-set>
          <D:privilege><D:read/><D:write/></D:privilege>
        </D:current-user-privilege-set>
        <CS:getctag>${groups.length}-${rows.reduce((total, row) => total + (row.updated_at || 0), 0)}</CS:getctag>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>`,
    ...eventResponses
  ]
}

function unauthorized() {
  return new Response('Unauthorized', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Timeline CalDAV", charset="UTF-8"',
      'Content-Type': 'text/plain; charset=utf-8'
    }
  })
}

function caldavError(status, message) {
  return new Response(message, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  })
}

export async function authenticateCalDav(req, dependencies = {}) {
  const authorization = req.headers.get('authorization')
  if (!authorization?.startsWith('Basic ')) return null

  try {
    const decoded = Buffer.from(authorization.slice(6), 'base64').toString('utf8')
    const separator = decoded.indexOf(':')
    if (separator < 0) return null

    const username = decoded.slice(0, separator)
    const password = decoded.slice(separator + 1)
    const { prepared } = dependencies
    const statements = prepared || preparedStatements
    const user = statements.getUserByUsername.get(username)
    if (!user) return null

    const { valid } = await verifyPassword(password, user.password_hash)
    return valid ? user : null
  } catch {
    return null
  }
}

function getRows(dependencies = {}) {
  const { prepared } = dependencies
  return (prepared || preparedStatements).getCalDavMeetings.all()
}

function getEventByUid(uid, dependencies = {}) {
  const { prepared } = dependencies
  const statements = prepared || preparedStatements

  const rows = statements.getCalDavMeetingsByUid.all(uid)
  if (rows.length) return groupEvents(rows)[0]

  const legacyId = Number(uid.replace(/@timeline$/, ''))
  if (Number.isInteger(legacyId) && legacyId > 0) {
    const row = statements.getCalDavMeetingById.get(legacyId)
    if (row && !row.uid) return groupEvents([row])[0]
  }

  return null
}

function unescapeIcsText(value) {
  return value
    .replaceAll('\\n', '\n')
    .replaceAll('\\N', '\n')
    .replaceAll('\\,', ',')
    .replaceAll('\\;', ';')
    .replaceAll('\\\\', '\\')
}

function isValidUtcDate(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
}

function parseIcsDateValue(value) {
  if (!/^\d{8}$/.test(value)) return null
  const year = Number(value.slice(0, 4))
  const month = Number(value.slice(4, 6))
  const day = Number(value.slice(6, 8))
  if (!isValidUtcDate(year, month, day)) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function unfoldIcs(text) {
  return String(text).replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '')
}

export function parseCalDavEvent(body) {
  const lines = unfoldIcs(body).split(/\r\n|\n|\r/)
  if (lines.filter(line => line.trim() === 'BEGIN:VEVENT').length !== 1) {
    return { error: 'CalDAV 事件必须只包含一个 VEVENT' }
  }

  const start = lines.findIndex(line => line.trim() === 'BEGIN:VEVENT')
  const end = lines.findIndex(line => line.trim() === 'END:VEVENT')
  if (start < 0 || end <= start) {
    return { error: 'CalDAV 事件格式无效' }
  }

  const properties = lines.slice(start + 1, end)
  if (properties.some(line => line.toUpperCase().startsWith('RRULE:'))) {
    return { error: '暂不支持重复事件' }
  }

  let uid
  let summary = ''
  let startDate
  let endDate

  for (const line of properties) {
    const separator = line.indexOf(':')
    if (separator < 0) continue
    const name = line.slice(0, separator).toUpperCase()
    const value = line.slice(separator + 1)

    if (name.startsWith('UID')) {
      uid = value.trim()
    } else if (name.startsWith('SUMMARY')) {
      summary = unescapeIcsText(value)
    } else if (name.startsWith('DTSTART')) {
      if (name.includes('TZID') || name.includes('VALUE=DATE-TIME') || value.includes('T')) {
        return { error: '暂不支持带具体时间的日程' }
      }
      startDate = parseIcsDateValue(value.trim())
    } else if (name.startsWith('DTEND')) {
      if (name.includes('TZID') || name.includes('VALUE=DATE-TIME') || value.includes('T')) {
        return { error: '暂不支持带具体时间的日程' }
      }
      endDate = parseIcsDateValue(value.trim())
    } else if (name.startsWith('DURATION')) {
      return { error: '暂不支持 DURATION 日程' }
    }
  }

  if (!startDate) return { error: '缺少有效的 DTSTART 全天日期' }

  const dates = []
  if (endDate) {
    let cursor = parseUtcDate(startDate)
    const limit = parseUtcDate(endDate)
    while (cursor < limit) {
      dates.push(
        `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}-${String(
          cursor.getUTCDate()
        ).padStart(2, '0')}`
      )
      cursor = addDays(cursor, 1)
    }
  } else {
    dates.push(startDate)
  }

  if (dates.length === 0) return { error: '日程日期范围无效' }
  if (dates.length > MAX_EVENT_DAYS) return { error: '日程范围最多支持366天' }

  const normalizedSummary = summary.trim()
  const note = normalizedSummary === '见面'
    ? ''
    : normalizedSummary.startsWith('见面：')
      ? normalizedSummary.slice(3)
      : normalizedSummary

  return {
    uid: uid || `${crypto.randomUUID()}@timeline`,
    note,
    dates
  }
}

async function putEvent(req, username, uid, dependencies = {}) {
  const body = await req.text()
  const parsed = parseCalDavEvent(body)
  if (parsed.error) return caldavError(400, parsed.error)
  if (parsed.uid !== uid && uid !== 'new.ics') {
    return caldavError(400, '请求路径 UID 与事件 UID 不一致')
  }

  const { db: database = db, prepared } = dependencies
  const statements = prepared || preparedStatements
  const existing = getEventByUid(uid, dependencies)
  const ifMatch = req.headers.get('if-match')?.trim()

  if (ifMatch && ifMatch !== '*') {
    if (!existing || eventEtag(existing) !== ifMatch) {
      return caldavError(412, 'Precondition Failed')
    }
  }

  for (const date of parsed.dates) {
    const occupied = statements.getMeetingByDate.get(date)
    if (occupied && (!existing || !existing.ids.includes(Number(occupied.id)))) {
      return caldavError(409, `该日期已存在：${date}`)
    }
  }

  const now = Date.now()
  const save = database.transaction(() => {
    if (existing) {
      for (const id of existing.ids) {
        statements.deleteMeeting.run(id)
      }
    }

    for (const date of parsed.dates) {
      statements.insertMeeting.run(date, parsed.note, parsed.uid, now)
    }
  })
  save()

  const saved = getEventByUid(parsed.uid, dependencies)
  return new Response(null, {
    status: existing ? 204 : 201,
    headers: {
      ETag: eventEtag(saved),
      Location: eventHref(username, saved)
    }
  })
}

function deleteEvent(username, uid, req, dependencies = {}) {
  const existing = getEventByUid(uid, dependencies)
  if (!existing) return caldavError(404, 'Not Found')

  const ifMatch = req.headers.get('if-match')?.trim()
  if (ifMatch && ifMatch !== '*' && eventEtag(existing) !== ifMatch) {
    return caldavError(412, 'Precondition Failed')
  }

  const { db: database = db, prepared } = dependencies
  const statements = prepared || preparedStatements
  const remove = database.transaction(() => {
    if (existing.uid) {
      statements.deleteMeetingsByUid.run(existing.uid)
      return
    }
    for (const id of existing.ids) {
      statements.deleteMeeting.run(id)
    }
  })
  remove()

  return new Response(null, { status: 204 })
}

export async function handleCalDav(req, { method, pathname }, dependencies = {}) {
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        DAV: '1, 2, calendar-access',
        Allow: 'OPTIONS, GET, HEAD, PROPFIND, REPORT, PUT, DELETE',
        'Content-Length': '0'
      }
    })
  }

  const user = await authenticateCalDav(req, dependencies)
  if (!user) return unauthorized()
  const normalized = normalizePath(pathname)

  if (method === 'PROPFIND') {
    if (normalized === '/caldav') {
      return multistatus([principalResponse(user.username)])
    }

    const principalMatch = normalized.match(/^\/caldav\/principal\/([^/]+)$/)
    if (principalMatch && decodeURIComponent(principalMatch[1]) === user.username) {
      return multistatus([homeResponse(user.username)])
    }

    const shortCollectionMatch = normalized.match(/^\/caldav\/([^/]+)$/)
    if (
      shortCollectionMatch &&
      !['principal', 'calendars'].includes(shortCollectionMatch[1]) &&
      decodeURIComponent(shortCollectionMatch[1]) === user.username
    ) {
      const rows = getRows(dependencies)
      const includeEvents = req.headers.get('depth') !== '0'
      return multistatus(collectionResponse(user.username, includeEvents, rows))
    }

    const collectionMatch = normalized.match(/^\/caldav\/calendars\/([^/]+)$/)
    if (collectionMatch) {
      if (decodeURIComponent(collectionMatch[1]) !== user.username) {
        return caldavError(403, 'Forbidden')
      }
      const rows = getRows(dependencies)
      const includeEvents = req.headers.get('depth') !== '0'
      return multistatus(collectionResponse(user.username, includeEvents, rows))
    }

    const eventMatch = normalized.match(/^\/caldav\/calendars\/([^/]+)\/(.+)\.ics$/)
    if (eventMatch) {
      if (decodeURIComponent(eventMatch[1]) !== user.username) {
        return caldavError(403, 'Forbidden')
      }
      const group = getEventByUid(decodeURIComponent(eventMatch[2]), dependencies)
      if (!group) return caldavError(404, 'Not Found')
      return multistatus([eventResponse(user.username, group)])
    }

    return caldavError(404, 'Not Found')
  }

  if (method === 'REPORT') {
    const collectionMatch = normalized.match(/^\/caldav\/calendars\/([^/]+)$/)
    if (!collectionMatch || decodeURIComponent(collectionMatch[1]) !== user.username) {
      return caldavError(403, 'Forbidden')
    }

    const rows = getRows(dependencies)
    const groups = groupEvents(rows)
    const body = await req.text().catch(() => '')
    let selected = groups

    if (body.includes('calendar-multiget')) {
      const hrefs = new Set(
        [...body.matchAll(/<(?:[A-Za-z0-9_.-]+:)?href\b[^>]*>([^<]+)<\/(?:[A-Za-z0-9_.-]+:)?href>/gi)]
          .map(match => match[1].trim())
      )
      selected = groups.filter(group => {
        const href = eventHref(user.username, group)
        return hrefs.has(href) || hrefs.has(decodeURIComponent(href))
      })
    }

    const responses = selected.map(group => eventResponse(user.username, group))
    return multistatus(
      responses,
      body.includes('sync-collection') ? `timeline-${groups.length}` : null
    )
  }

  const eventMatch = normalized.match(/^\/caldav\/calendars\/([^/]+)\/(.+)\.ics$/)

  if (method === 'GET' || method === 'HEAD') {
    if (normalized === `/caldav/calendars/${encodeURIComponent(user.username)}`) {
      const rows = getRows(dependencies)
      return new Response(buildIcs(rows), {
        status: 200,
        headers: {
          'Content-Type': 'text/calendar; charset=utf-8',
          'Cache-Control': 'no-store',
          DAV: '1, 2, calendar-access'
        }
      })
    }

    if (eventMatch && decodeURIComponent(eventMatch[1]) === user.username) {
      const group = getEventByUid(decodeURIComponent(eventMatch[2]), dependencies)
      if (!group) return caldavError(404, 'Not Found')
      return new Response(buildEvent(group), {
        status: 200,
        headers: {
          'Content-Type': 'text/calendar; charset=utf-8',
          ETag: eventEtag(group),
          'Cache-Control': 'no-store'
        }
      })
    }

    return caldavError(404, 'Not Found')
  }

  if (method === 'PUT' && eventMatch) {
    if (decodeURIComponent(eventMatch[1]) !== user.username) {
      return caldavError(403, 'Forbidden')
    }
    return putEvent(req, user.username, decodeURIComponent(eventMatch[2]), dependencies)
  }

  if (method === 'DELETE' && eventMatch) {
    if (decodeURIComponent(eventMatch[1]) !== user.username) {
      return caldavError(403, 'Forbidden')
    }
    return deleteEvent(user.username, decodeURIComponent(eventMatch[2]), req, dependencies)
  }

  if (['PUT', 'DELETE'].includes(method)) return caldavError(400, 'Bad Request')
  return caldavError(405, 'Method Not Allowed')
}
