import { db, preparedStatements } from '../db/index.js'
import { CONFIG } from '../config/index.js'
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
import { requestBaseUrl } from '../utils/request.js'
import {
  MEETING_CATEGORIES,
  getMeetingCategory
} from './categories.service.js'

const MAX_EVENT_DAYS = 366

function calendarHomeHref(username) {
  return `/caldav/calendars/${encodeURIComponent(username)}/`
}

function calendarCollectionHref(username, category = 'meetings') {
  return `/caldav/calendars/${encodeURIComponent(username)}/${encodeURIComponent(category)}/`
}

function absoluteHref(baseUrl, href) {
  return href
}

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
      category: row.category || 'meetings',
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
      group.updated_at || 0,
      group.category || 'meetings'
    ].join('|')
  )
  return `"${hash.slice(0, 32)}"`
}

function eventHref(username, group, hrefCategory = null) {
  const uid = encodeURIComponent(eventUid(group))
  if (hrefCategory === '__root__') {
    return `${calendarHomeHref(username)}${uid}.ics`
  }
  return `${calendarCollectionHref(username, hrefCategory || group.category || 'meetings')}${uid}.ics`
}

function buildEvent(group) {
  const start = parseUtcDate(group.date.split('T')[0])
  const end = parseUtcDate(group.end_date.split('T')[0])
  const note = group.note ? group.note.trim() : ''
  const category = getMeetingCategory(group.category || 'meetings') || MEETING_CATEGORIES[0]
  const summary = note ? `${category.name}：${note}` : category.name
  const event = [
    'BEGIN:VEVENT',
    `UID:${eventUid(group)}`,
    `DTSTAMP:${formatIcsDate(new Date())}T000000Z`,
    `DTSTART;VALUE=DATE:${formatIcsDate(start)}`,
    `DTEND;VALUE=DATE:${formatIcsDate(addDays(end, 1))}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    `CATEGORIES:${escapeIcsText(category.name)}`,
    'STATUS:CONFIRMED',
    'TRANSP:TRANSPARENT',
    'END:VEVENT'
  ]

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Timeline//Calendar 1.0//CN',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escapeIcsText(category.name)}`,
    ...event,
    'END:VCALENDAR'
  ].flatMap(foldIcsLine).join('\r\n') + '\r\n'
}

function multistatus(responses, syncToken = null) {
  const body = `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav" xmlns:CS="http://calendarserver.org/ns/" xmlns:IC="http://apple.com/ns/ical/">
${responses.join('\n')}${syncToken ? `\n<D:sync-token>${xmlEscape(syncToken)}</D:sync-token>` : ''}
</D:multistatus>`
  return new Response(body, {
    status: 207,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'DAV': '1, calendar-access'
    }
  })
}

function eventResponse(username, group, hrefCategory = null) {
  const props = [
    '<D:resourcetype/>',
    '<D:getcontenttype>text/calendar; component=vevent</D:getcontenttype>',
    `<D:getetag>${xmlEscape(eventEtag(group))}</D:getetag>`,
    `<C:calendar-data>${xmlEscape(buildEvent(group))}</C:calendar-data>`
  ]

  return `  <D:response>
    <D:href>${xmlEscape(eventHref(username, group, hrefCategory))}</D:href>
    <D:propstat>
      <D:prop>
        ${props.join('\n        ')}
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>`
}

function currentUserPrivilegeSet() {
  return `<D:current-user-privilege-set>
          <D:privilege><D:all/></D:privilege>
          <D:privilege><D:read/></D:privilege>
          <D:privilege><D:write/></D:privilege>
          <D:privilege><D:write-properties/></D:privilege>
          <D:privilege><D:write-content/></D:privilege>
          <D:privilege><D:bind/></D:privilege>
          <D:privilege><D:unbind/></D:privilege>
        </D:current-user-privilege-set>`
}

function supportedReportSet() {
  return `<D:supported-report-set>
          <D:supported-report>
            <D:report><C:calendar-multiget/></D:report>
          </D:supported-report>
          <D:supported-report>
            <D:report><C:calendar-query/></D:report>
          </D:supported-report>
          <D:supported-report>
            <D:report><D:sync-collection/></D:report>
          </D:supported-report>
        </D:supported-report-set>`
}

const PROPFIND_NAMESPACES = {
  D: 'DAV:',
  C: 'urn:ietf:params:xml:ns:caldav',
  CS: 'http://calendarserver.org/ns/',
  IC: 'http://apple.com/ns/ical/'
}

function parseXmlNamespaces(text) {
  const namespaces = {}
  const pattern = /\sxmlns(?::([^\s=/]+))?\s*=\s*(["'])(.*?)\2/g

  for (const match of text.matchAll(pattern)) {
    namespaces[match[1] || ''] = match[3]
  }

  return namespaces
}

function propIdentity(tagName, namespaces = {}) {
  const separator = tagName.indexOf(':')
  const prefix = separator >= 0 ? tagName.slice(0, separator) : ''
  const localName = separator >= 0 ? tagName.slice(separator + 1) : tagName
  const namespaceUri = namespaces[prefix] || PROPFIND_NAMESPACES[prefix] || prefix
  return `${namespaceUri}\u0000${localName.toLowerCase()}`
}

function requestedPropfindProps(body) {
  const text = String(body)
  if (!text.trim() || text.toLowerCase().includes('<d:allprop') || /<(?:[A-Za-z0-9_.-]+:)?allprop\b/i.test(text)) {
    return null
  }

  const propMatch = text.match(/<(?:[A-Za-z0-9_.-]+:)?prop(?:\s[^>]*)?>([\s\S]*?)<\/(?:[A-Za-z0-9_.-]+:)?prop>/i)
  if (!propMatch) return null

  const namespaces = parseXmlNamespaces(text)
  const tagPattern = /<(\/?)([A-Za-z_][\w.-]*(?::[A-Za-z_][\w.-]*)?)(?:\s[^>]*?)?\s*(\/?)>/g
  const props = []
  let depth = 0

  for (const match of propMatch[1].matchAll(tagPattern)) {
    const [, closing, name, selfClosing] = match

    if (closing) {
      depth -= 1
      continue
    }

    if (depth === 0) {
      props.push(propIdentity(name, namespaces))
      if (!selfClosing) depth += 1
    } else if (!selfClosing) {
      depth += 1
    }
  }

  return props.length ? new Set(props) : null
}

function selectPropfindProps(body, allProps) {
  const requested = requestedPropfindProps(body)
  if (!requested) return allProps
  return allProps.filter(prop => {
    const name = prop.match(/^<([A-Za-z0-9_.-]+(?::[A-Za-z0-9_.-]+)?)/)?.[1]
    return name ? requested.has(propIdentity(name)) : false
  })
}

function principalResponse(username, body = '', baseUrl = '') {
  const principalHref = `/caldav/principal/${encodeURIComponent(username)}/`
  const absolutePrincipalHref = absoluteHref(baseUrl, principalHref)
  const absoluteHomeHref = absoluteHref(baseUrl, calendarHomeHref(username))
  const props = selectPropfindProps(body, [
    `<D:principal-URL><D:href>${xmlEscape(absolutePrincipalHref)}</D:href></D:principal-URL>`,
    `<D:current-user-principal>\n          <D:href>${xmlEscape(absolutePrincipalHref)}</D:href>\n        </D:current-user-principal>`,
    '<D:resourcetype><D:collection/></D:resourcetype>',
    '<D:displayname>Timeline</D:displayname>',
    `<C:calendar-home-set>\n          <D:href>${xmlEscape(absoluteHomeHref)}</D:href>\n        </C:calendar-home-set>`,
    '<D:group-membership/>',
    currentUserPrivilegeSet()
  ])

  return `  <D:response>
    <D:href>/caldav/</D:href>
    <D:propstat>
      <D:prop>
        ${props.join('\n        ')}
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>`
}

function homeResponse(username, body = '', baseUrl = '') {
  const principalHref = absoluteHref(baseUrl, `/caldav/principal/${encodeURIComponent(username)}/`)
  const props = selectPropfindProps(body, [
    `<D:principal-URL><D:href>${xmlEscape(principalHref)}</D:href></D:principal-URL>`,
    `<D:current-user-principal>\n          <D:href>${xmlEscape(principalHref)}</D:href>\n        </D:current-user-principal>`,
    `<D:calendar-user-address-set>\n          <D:href>${xmlEscape(principalHref)}</D:href>\n        </D:calendar-user-address-set>`,
    '<D:resourcetype><D:principal/></D:resourcetype>',
    '<D:displayname>Timeline</D:displayname>',
    `<C:calendar-home-set>\n          <D:href>${xmlEscape(absoluteHref(baseUrl, calendarHomeHref(username)))}</D:href>\n        </C:calendar-home-set>`,
    '<D:group-membership/>',
    currentUserPrivilegeSet(),
    supportedReportSet()
  ])

  return `  <D:response>
    <D:href>${xmlEscape(principalHref)}</D:href>
    <D:propstat>
      <D:prop>
        ${props.join('\n        ')}
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>`
}

function calendarCollectionResponse(
  username,
  category,
  includeEvents,
  rows,
  body = '',
  baseUrl = '',
  collectionHref = null,
  hrefCategory = null
) {
  const principalHref = absoluteHref(baseUrl, `/caldav/principal/${encodeURIComponent(username)}/`)
  const categoryMeta = getMeetingCategory(category) || MEETING_CATEGORIES[0]
  const groups = groupEvents(rows)
  const ctag = `${category}-${groups.length}-${rows.reduce((total, row) => total + (row.updated_at || 0), 0)}`
  const lastModified = new Date(
    rows.reduce((latest, row) => Math.max(latest, row.updated_at || 0), 0)
  ).toUTCString()
  const eventResponses = includeEvents
    ? groups.map(group => eventResponse(username, group, hrefCategory))
    : []

  const props = selectPropfindProps(body, [
    `<D:displayname>${xmlEscape(categoryMeta.name)}</D:displayname>`,
    `<D:current-user-principal>\n          <D:href>${xmlEscape(principalHref)}</D:href>\n        </D:current-user-principal>`,
    `<D:principal-URL><D:href>${xmlEscape(principalHref)}</D:href></D:principal-URL>`,
    `<D:owner><D:href>${xmlEscape(principalHref)}</D:href></D:owner>`,
    '<D:resourcetype><D:collection/><C:calendar/></D:resourcetype>',
    `<C:calendar-home-set>\n          <D:href>${xmlEscape(absoluteHref(baseUrl, calendarHomeHref(username)))}</D:href>\n        </C:calendar-home-set>`,
    `<C:calendar-description>${xmlEscape(categoryMeta.name)}</C:calendar-description>`,
    `<IC:calendar-color>${categoryMeta.color}</IC:calendar-color>`,
    '<C:supported-calendar-component-set><C:comp name="VEVENT"/></C:supported-calendar-component-set>',
    `<C:supported-calendar-data>\n          <C:calendar-data-type content-type="text/calendar" version="2.0"/>\n        </C:supported-calendar-data>`,
    currentUserPrivilegeSet(),
    supportedReportSet(),
    `<D:getetag>${xmlEscape(`"${ctag}"`)}</D:getetag>`,
    `<D:sync-token>${xmlEscape(ctag)}</D:sync-token>`,
    `<D:getlastmodified>${xmlEscape(lastModified)}</D:getlastmodified>`,
    '<D:creationdate>1970-01-01T00:00:00Z</D:creationdate>',
    '<D:getcontenttype>httpd/unix-directory</D:getcontenttype>',
    '<D:getcontentlanguage>zh-CN</D:getcontentlanguage>',
    '<D:supportedlock/>',
    '<D:lockdiscovery/>',
    `<CS:getctag>${ctag}</CS:getctag>`
  ])

  return [
    `  <D:response>
    <D:href>${xmlEscape(collectionHref || absoluteHref(baseUrl, calendarCollectionHref(username, category)))}</D:href>
    <D:propstat>
      <D:prop>
        ${props.join('\n        ')}
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>`,
    ...eventResponses
  ]
}

function homeCollectionResponse(username, includeChild, body = '', baseUrl = '') {
  const principalHref = absoluteHref(baseUrl, `/caldav/principal/${encodeURIComponent(username)}/`)
  const homeHref = absoluteHref(baseUrl, calendarHomeHref(username))
  const props = selectPropfindProps(body, [
    '<D:displayname>Timeline</D:displayname>',
    `<D:current-user-principal>\n          <D:href>${xmlEscape(principalHref)}</D:href>\n        </D:current-user-principal>`,
    `<D:owner><D:href>${xmlEscape(principalHref)}</D:href></D:owner>`,
    '<D:resourcetype><D:collection/></D:resourcetype>',
    `<C:calendar-home-set>\n          <D:href>${xmlEscape(homeHref)}</D:href>\n        </C:calendar-home-set>`,
    currentUserPrivilegeSet(),
    `<D:getetag>${xmlEscape('"timeline-home"')}</D:getetag>`,
    '<D:creationdate>1970-01-01T00:00:00Z</D:creationdate>',
    '<D:getcontenttype>httpd/unix-directory</D:getcontenttype>'
  ])

  const homeResponse = `  <D:response>
    <D:href>${xmlEscape(homeHref)}</D:href>
    <D:propstat>
      <D:prop>
        ${props.join('\n        ')}
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>`

  const childResponses = includeChild
    ? MEETING_CATEGORIES.map(category => calendarCollectionResponse(
      username,
      category.id,
      false,
      [],
      body,
      baseUrl
    ))
    : []

  return [homeResponse, ...childResponses.flat()]
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

function parsePropPatchProperties(body) {
  const propMatch = String(body).match(
    /<([A-Za-z_][\w.-]*?:)?prop(?:\s[^>]*)?>([\s\S]*?)<\/\1?prop\s*>/i
  )
  if (!propMatch) return []

  const content = propMatch[2]
  const tagPattern = /<(\/?)([A-Za-z_][\w.-]*(?::[A-Za-z_][\w.-]*)?)(?:\s[^>]*)?(\/?)>/g
  const properties = []
  let depth = 0

  for (const match of content.matchAll(tagPattern)) {
    const [, closing, name, selfClosing] = match

    if (closing) {
      depth -= 1
      continue
    }

    if (depth === 0) {
      properties.push(selfClosing ? match[0] : `${match[0]}</${name}>`)
    }

    if (!selfClosing) depth += 1
  }

  return properties
}

function propPatchResponse(username, properties, isCalendarCollection = false) {
  return `  <D:response>
    <D:href>${xmlEscape(isCalendarCollection ? calendarCollectionHref(username) : calendarHomeHref(username))}</D:href>
    <D:propstat>
      <D:prop>${properties.join('')}</D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>`
}

function resolveCategorySegment(segment) {
  const category = decodeURIComponent(segment)
  return category === 'timeline' ? 'meetings' : category
}

function isCategorySegment(segment) {
  const category = resolveCategorySegment(segment)
  return Boolean(getMeetingCategory(category))
}

function parseCalendarCollectionPath(pathname, username) {
  const match = pathname.match(/^\/caldav\/calendars\/([^/]+)\/([^/]+)$/)
  if (!match || decodeURIComponent(match[1]) !== username || !isCategorySegment(match[2])) {
    return null
  }

  return {
    category: resolveCategorySegment(match[2]),
    hrefCategory: decodeURIComponent(match[2]) === 'timeline' ? 'timeline' : resolveCategorySegment(match[2])
  }
}

function parseEventPath(pathname, username) {
  const categoryMatch = pathname.match(/^\/caldav\/calendars\/([^/]+)\/([^/]+)\/(.+)\.ics$/)
  if (
    categoryMatch &&
    decodeURIComponent(categoryMatch[1]) === username &&
    isCategorySegment(categoryMatch[2])
  ) {
    return {
      category: resolveCategorySegment(categoryMatch[2]),
      hrefCategory: decodeURIComponent(categoryMatch[2]) === 'timeline'
        ? 'timeline'
        : resolveCategorySegment(categoryMatch[2]),
      uid: decodeURIComponent(categoryMatch[3])
    }
  }

  const legacyMatch = pathname.match(/^\/caldav\/calendars\/([^/]+)\/(.+)\.ics$/)
  if (!legacyMatch || decodeURIComponent(legacyMatch[1]) !== username) return null

  return {
    category: 'meetings',
    hrefCategory: '__root__',
    uid: decodeURIComponent(legacyMatch[2])
  }
}

function caldavError(status, message) {
  return new Response(message, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  })
}

let calDavDebugSequence = 0

const REDACTED_HEADERS = new Set([
  'authorization',
  'cookie',
  'cookie2',
  'proxy-authorization',
  'set-cookie'
])

function safeDebugHeaders(headers) {
  return Object.fromEntries([...headers].map(([name, value]) => [
    name,
    REDACTED_HEADERS.has(name.toLowerCase()) ? '<redacted>' : value
  ]))
}

async function debugResource(resource) {
  try {
    const body = await resource.clone().text()
    return { bodyLength: body.length, body }
  } catch (error) {
    return { bodyLength: null, body: null, bodyError: String(error) }
  }
}

async function debugRequest(req, debugId) {
  if (!CONFIG.CALDAV_DEBUG) return

  const url = new URL(req.url)
  const body = await debugResource(req)
  console.log('[CalDAV request]', JSON.stringify({
    debugId,
    method: req.method,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams),
    headers: safeDebugHeaders(req.headers),
    ...body
  }))
}

async function debugResponse(response, debugId) {
  if (!CONFIG.CALDAV_DEBUG) return

  const body = await debugResource(response)
  console.log('[CalDAV response]', JSON.stringify({
    debugId,
    status: response.status,
    headers: safeDebugHeaders(response.headers),
    ...body
  }))
}

function nextCalDavDebugId() {
  calDavDebugSequence += 1
  return `${Date.now().toString(36)}-${calDavDebugSequence}`
}

export async function handleCalDav(req, context = {}, dependencies = {}) {
  const debugId = CONFIG.CALDAV_DEBUG ? nextCalDavDebugId() : null
  await debugRequest(req, debugId)

  try {
    const response = await handleCalDavRequest(req, context, dependencies)
    await debugResponse(response, debugId)
    return response
  } catch (error) {
    if (CONFIG.CALDAV_DEBUG) {
      console.error('[CalDAV error]', JSON.stringify({ debugId, error: String(error) }))
    }
    throw error
  }
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

function getRows(dependencies = {}, category = '') {
  const { prepared } = dependencies
  const statements = prepared || preparedStatements
  return category ? statements.getCalDavMeetingsByCategory.all(category) : statements.getCalDavMeetings.all()
}

function getEventByUid(uid, dependencies = {}, category = '') {
  const { prepared } = dependencies
  const statements = prepared || preparedStatements

  const rows = statements.getCalDavMeetingsByUid.all(uid)
    .filter(row => !category || (row.category || 'meetings') === category)
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
  const categoryPrefix = MEETING_CATEGORIES.find(category => {
    const label = category.name
    return normalizedSummary === label || normalizedSummary.startsWith(`${label}：`)
  })
  const note = categoryPrefix
    ? normalizedSummary === categoryPrefix.name
      ? ''
      : normalizedSummary.slice(categoryPrefix.name.length + 1)
    : normalizedSummary

  return {
    uid: uid || `${crypto.randomUUID()}@timeline`,
    note,
    dates
  }
}

async function putEvent(req, username, uid, category, dependencies = {}) {
  const body = await req.text()
  const parsed = parseCalDavEvent(body)
  if (parsed.error) return caldavError(400, parsed.error)
  if (parsed.uid !== uid && uid !== 'new.ics') {
    return caldavError(400, '请求路径 UID 与事件 UID 不一致')
  }

  const { db: database = db, prepared } = dependencies
  const statements = prepared || preparedStatements
  const existing = getEventByUid(uid, dependencies, category)
  const ifMatch = req.headers.get('if-match')?.trim()

  if (ifMatch && ifMatch !== '*') {
    if (!existing || eventEtag(existing) !== ifMatch) {
      return caldavError(412, 'Precondition Failed')
    }
  }

  for (const date of parsed.dates) {
    const occupied = statements.getMeetingByDate.get(date, category)
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
      statements.insertMeeting.run(date, parsed.note, parsed.uid, now, category)
    }
  })
  save()

  const saved = getEventByUid(parsed.uid, dependencies, category)
  return new Response(null, {
    status: existing ? 204 : 201,
    headers: {
      ETag: eventEtag(saved),
      Location: eventHref(username, saved)
    }
  })
}

function deleteEvent(username, uid, category, req, dependencies = {}) {
  const existing = getEventByUid(uid, dependencies, category)
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

async function handleCalDavRequest(req, { method, pathname }, dependencies = {}) {
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        DAV: '1, calendar-access',
        Allow: 'OPTIONS, GET, HEAD, PROPFIND, PROPPATCH, REPORT, PUT, DELETE',
        'Content-Length': '0'
      }
    })
  }

  const user = await authenticateCalDav(req, dependencies)
  if (!user) return unauthorized()
  const normalized = normalizePath(pathname)
  const requestBody = method === 'PROPFIND'
    ? await req.text().catch(() => '')
    : ''
  const baseUrl = requestBaseUrl(req)

  if (method === 'PROPFIND') {
    if (normalized === '/caldav') {
      return multistatus([principalResponse(user.username, requestBody, baseUrl)])
    }

    const principalMatch = normalized.match(/^\/caldav\/principal\/([^/]+)$/)
    if (principalMatch && decodeURIComponent(principalMatch[1]) === user.username) {
      return multistatus([homeResponse(user.username, requestBody, baseUrl)])
    }

    const calendarCollectionMatch = /^\/caldav\/calendars\/([^/]+)\/([^/]+)$/.exec(normalized)
    if (
      calendarCollectionMatch &&
      decodeURIComponent(calendarCollectionMatch[1]) === user.username &&
      isCategorySegment(calendarCollectionMatch[2])
    ) {
      const category = resolveCategorySegment(calendarCollectionMatch[2])
      const hrefCategory = decodeURIComponent(calendarCollectionMatch[2]) === 'timeline'
        ? 'timeline'
        : category
      const rows = getRows(dependencies, category)
      const includeEvents = req.headers.get('depth') !== '0'
      return multistatus(calendarCollectionResponse(
        user.username,
        category,
        includeEvents,
        rows,
        requestBody,
        baseUrl,
        absoluteHref(baseUrl, `${normalized}/`),
        hrefCategory
      ))
    }

    const shortTimelineCollectionMatch = normalized.match(/^\/caldav\/([^/]+)\/timeline$/)
    if (
      shortTimelineCollectionMatch &&
      !['principal', 'calendars'].includes(shortTimelineCollectionMatch[1]) &&
      decodeURIComponent(shortTimelineCollectionMatch[1]) === user.username
    ) {
      const rows = getRows(dependencies, 'meetings')
      const includeEvents = req.headers.get('depth') !== '0'
      return multistatus(calendarCollectionResponse(
        user.username,
        'meetings',
        includeEvents,
        rows,
        requestBody,
        baseUrl,
        absoluteHref(baseUrl, `${normalized}/`),
        'timeline'
      ))
    }

    const collectionMatch = normalized.match(/^\/caldav\/calendars\/([^/]+)$/)
    if (collectionMatch) {
      if (decodeURIComponent(collectionMatch[1]) !== user.username) {
        return caldavError(403, 'Forbidden')
      }
      const includeChild = req.headers.get('depth') !== '0'
      return multistatus(homeCollectionResponse(user.username, includeChild, requestBody, baseUrl))
    }

    const shortCollectionMatch = normalized.match(/^\/caldav\/([^/]+)$/)
    if (
      shortCollectionMatch &&
      !['principal', 'calendars'].includes(shortCollectionMatch[1]) &&
      decodeURIComponent(shortCollectionMatch[1]) === user.username
    ) {
      const rows = getRows(dependencies, 'meetings')
      const depthZero = req.headers.get('depth') === '0'
      return multistatus(calendarCollectionResponse(
        user.username,
        'meetings',
        !depthZero,
        rows,
        requestBody,
        baseUrl,
        absoluteHref(baseUrl, `${normalized}/`),
        'meetings'
      ))
    }

    const eventMatch = parseEventPath(normalized, user.username)
    if (eventMatch) {
      const group = getEventByUid(eventMatch.uid, dependencies, eventMatch.category)
      if (!group) return caldavError(404, 'Not Found')
      return multistatus([eventResponse(user.username, group, eventMatch.hrefCategory)])
    }

    return caldavError(404, 'Not Found')
  }

  if (method === 'REPORT') {
    const homeMatch = normalized.match(/^\/caldav\/calendars\/([^/]+)$/)
    const collection = parseCalendarCollectionPath(normalized, user.username)
      || (homeMatch && decodeURIComponent(homeMatch[1]) === user.username
        ? { category: '', hrefCategory: '__root__' }
        : null)
    if (!collection) {
      return caldavError(403, 'Forbidden')
    }

    const rows = getRows(dependencies, collection.category)
    const groups = groupEvents(rows)
    const body = await req.text().catch(() => '')
    let selected = groups

    if (body.includes('calendar-multiget')) {
      const hrefs = new Set(
        [...body.matchAll(/<(?:[A-Za-z0-9_.-]+:)?href\b[^>]*>([^<]+)<\/(?:[A-Za-z0-9_.-]+:)?href>/gi)]
          .map(match => match[1].trim())
      )
      selected = groups.filter(group => {
        const href = eventHref(user.username, group, collection.hrefCategory)
        const hrefCandidates = [href, decodeURIComponent(href)]
        if (collection.hrefCategory === 'timeline') {
          const meetingHref = eventHref(user.username, group, 'meetings')
          hrefCandidates.push(meetingHref, decodeURIComponent(meetingHref))
          const rootHref = eventHref(user.username, group, '__root__')
          hrefCandidates.push(rootHref, decodeURIComponent(rootHref))
        }
        return hrefCandidates.some(candidate => hrefs.has(candidate))
      })
    }

    const responses = selected.map(group => eventResponse(
      user.username,
      group,
      collection.hrefCategory
    ))
    return multistatus(
      responses,
      body.includes('sync-collection') ? `${collection.category}-${groups.length}` : null
    )
  }

  if (method === 'PROPPATCH') {
    const homeMatch = normalized.match(/^\/caldav\/calendars\/([^/]+)$/)
    const collection = parseCalendarCollectionPath(normalized, user.username) || (homeMatch && decodeURIComponent(homeMatch[1]) === user.username
      ? { category: 'meetings', hrefCategory: 'meetings' }
      : null)
    if (!collection) {
      return caldavError(403, 'Forbidden')
    }

    const body = await req.text().catch(() => '')
    const properties = parsePropPatchProperties(body)
    if (!properties.length) return caldavError(400, 'PROPPATCH 请求格式无效')

    // Apple clients set display-only properties such as calendar color here.
    // Timeline owns fixed server-side calendars, so display-only properties are
    // accepted but not persisted.
    return multistatus([propPatchResponse(user.username, properties, true)])
  }

  const eventMatch = parseEventPath(normalized, user.username)

  if (method === 'GET' || method === 'HEAD') {
    const categoryCollection = parseCalendarCollectionPath(normalized, user.username)
    if (categoryCollection) {
      const rows = getRows(dependencies, categoryCollection.category)
      return new Response(buildIcs(rows), {
        status: 200,
        headers: {
          'Content-Type': 'text/calendar; charset=utf-8',
          'Cache-Control': 'no-store',
          DAV: '1, calendar-access'
        }
      })
    }

    if (
      normalized === `/caldav/calendars/${encodeURIComponent(user.username)}` ||
      normalized === `/caldav/calendars/${encodeURIComponent(user.username)}/timeline`
    ) {
      const rows = getRows(dependencies)
      return new Response(buildIcs(rows), {
        status: 200,
        headers: {
          'Content-Type': 'text/calendar; charset=utf-8',
          'Cache-Control': 'no-store',
          DAV: '1, calendar-access'
        }
      })
    }

    if (eventMatch) {
      const group = getEventByUid(eventMatch.uid, dependencies, eventMatch.category)
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
    return putEvent(
      req,
      user.username,
      eventMatch.uid,
      eventMatch.category,
      dependencies
    )
  }

  if (method === 'DELETE' && eventMatch) {
    return deleteEvent(
      user.username,
      eventMatch.uid,
      eventMatch.category,
      req,
      dependencies
    )
  }

  if (['PUT', 'DELETE'].includes(method)) return caldavError(400, 'Bad Request')
  return caldavError(405, 'Method Not Allowed')
}
