import { describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { handleCalDav, parseCalDavEvent } from './caldav.service.js'

function createTestDb() {
  const database = new Database(':memory:')
  database.run(`CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
  )`)
  database.run(`CREATE TABLE meetings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    note TEXT,
    created_at INTEGER NOT NULL DEFAULT 0,
    uid TEXT,
    updated_at INTEGER NOT NULL,
    category TEXT NOT NULL DEFAULT 'meetings',
    UNIQUE(date, category)
  )`)
  database.run(`CREATE TABLE sessions (token TEXT PRIMARY KEY, expires INTEGER NOT NULL, created_at INTEGER NOT NULL DEFAULT 0, user_id INTEGER)`)
  database.run(`CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL)`)
  database.run(`CREATE TABLE calendar_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    token TEXT NOT NULL,
    user_id INTEGER
  )`)

  const prepared = {
    getUserByUsername: database.prepare('SELECT id, username, role, password_hash, created_at, updated_at FROM users WHERE username = ?'),
    getCalDavMeetings: database.prepare('SELECT id, date, note, uid, updated_at, category FROM meetings ORDER BY date ASC, id ASC'),
    getCalDavMeetingsByCategory: database.prepare('SELECT id, date, note, uid, updated_at, category FROM meetings WHERE category = ? ORDER BY date ASC, id ASC'),
    getCalDavMeetingsByUid: database.prepare('SELECT id, date, note, uid, updated_at, category FROM meetings WHERE uid = ? ORDER BY date ASC, id ASC'),
    getCalDavMeetingById: database.prepare('SELECT id, date, note, uid, updated_at, category FROM meetings WHERE id = ?'),
    getMeetingByDate: database.prepare('SELECT id FROM meetings WHERE date = ? AND category = ?'),
    insertMeeting: database.prepare('INSERT INTO meetings (date, note, uid, updated_at, category) VALUES (?, ?, ?, ?, ?)'),
    updateMeetingNote: database.prepare('UPDATE meetings SET note = ?, category = ?, updated_at = ? WHERE id = ?'),
    deleteMeeting: database.prepare('DELETE FROM meetings WHERE id = ?'),
    deleteMeetingsByUid: database.prepare('DELETE FROM meetings WHERE uid = ?'),
    getIcsMeetings: database.prepare('SELECT id, date, note, uid, updated_at, category FROM meetings WHERE date <= ? ORDER BY date ASC, id ASC'),
  }

  return { database, prepared }
}

function basicAuth() {
  return { authorization: `Basic ${btoa('owner:secret')}` }
}

describe('CalDAV service', () => {
  test('returns CalDAV capabilities in OPTIONS', async () => {
    const response = await handleCalDav(
      new Request('http://localhost/caldav/', { method: 'OPTIONS' }),
      { method: 'OPTIONS', pathname: '/caldav/' }
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('DAV')).toBe('1, calendar-access')
    expect(response.headers.get('Allow')).toContain('PROPFIND')
  })

  test('parses all-day VEVENT values', () => {
    const parsed = parseCalDavEvent([
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'UID:client-event@calendar',
      'SUMMARY: Dinner',
      'DTSTART;VALUE=DATE:20260910',
      'DTEND;VALUE=DATE:20260911',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n'))

    expect(parsed.uid).toBe('client-event@calendar')
    expect(parsed.note).toBe('Dinner')
    expect(parsed.dates).toEqual(['2026-09-10'])
  })

  test('supports discovery, creation, update and deletion', async () => {
    const { database, prepared } = createTestDb()
    const passwordHash = await Bun.password.hash('secret')
    prepared.insertUser = database.prepare('INSERT INTO users (username, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?)')
    prepared.insertUser.run('owner', passwordHash, 1, 1)
    prepared.insertMeeting.run('2026-09-01', 'Old', 'legacy@timeline', 1, 'meetings')

    const context = { method: 'PROPFIND', pathname: '/caldav/' }
    const discovery = await handleCalDav(
      new Request('http://localhost/caldav/', { headers: basicAuth() }),
      context,
      { database, prepared }
    )
    expect(discovery.status).toBe(207)
    const discoveryBody = await discovery.text()
    expect(discoveryBody).toContain('current-user-principal')
    expect(discoveryBody).toContain('calendar-home-set')
    expect(discoveryBody).toContain('<D:displayname>Timeline</D:displayname>')
    expect(discoveryBody).toContain('/caldav/calendars/owner/')

    const defaultNamespaceDiscovery = await handleCalDav(
      new Request('http://localhost/caldav/', {
        method: 'PROPFIND',
        headers: { ...basicAuth(), Depth: '0', 'Content-Type': 'application/xml' },
        body: '<?xml version="1.0" encoding="UTF-8"?><propfind xmlns="DAV:"><prop><current-user-principal /></prop></propfind>'
      }),
      context,
      { database, prepared }
    )
    expect(defaultNamespaceDiscovery.status).toBe(207)
    const defaultNamespaceBody = await defaultNamespaceDiscovery.text()
    expect(defaultNamespaceBody).toContain('<D:current-user-principal>')
    expect(defaultNamespaceBody).toContain(
      '<D:href>/caldav/principal/owner/</D:href>'
    )
    expect(defaultNamespaceBody).not.toContain('<D:prop>\n        \n      </D:prop>')

    const principal = await handleCalDav(
      new Request('http://localhost/caldav/principal/owner/', {
        method: 'PROPFIND',
        headers: basicAuth()
      }),
      { method: 'PROPFIND', pathname: '/caldav/principal/owner/' },
      { database, prepared }
    )
    const principalBody = await principal.text()
    expect(principalBody).toContain('<C:calendar-home-set>')
    expect(principalBody).toContain('<D:calendar-user-address-set>')
    expect(principalBody).toContain('<D:displayname>Timeline</D:displayname>')

    const oppoPrincipal = await handleCalDav(
      new Request('http://localhost/caldav/principal/owner/', {
        method: 'PROPFIND',
        headers: { ...basicAuth(), Depth: '0', 'Content-Type': 'application/xml; charset=utf-8' },
        body: [
          '<?xml version=\'1.0\' encoding=\'UTF-8\' ?>',
          '<propfind xmlns="DAV:" xmlns:CAL="urn:ietf:params:xml:ns:caldav" xmlns:CARD="urn:ietf:params:xml:ns:carddav">',
          '<prop><displayname /><CAL:calendar-home-set /><group-membership /></prop>',
          '</propfind>'
        ].join('')
      }),
      { method: 'PROPFIND', pathname: '/caldav/principal/owner/' },
      { database, prepared }
    )
    expect(oppoPrincipal.status).toBe(207)
    const oppoPrincipalBody = await oppoPrincipal.text()
    expect(oppoPrincipalBody).toContain('<D:displayname>Timeline</D:displayname>')
    expect(oppoPrincipalBody).toContain('<C:calendar-home-set>')
    expect(oppoPrincipalBody).toContain('<D:group-membership/>')

    const propPatch = await handleCalDav(
      new Request('http://localhost/caldav/calendars/owner/', {
        method: 'PROPPATCH',
        headers: { ...basicAuth(), 'Content-Type': 'application/xml' },
        body: [
          '<?xml version="1.0" encoding="utf-8"?>',
          '<D:propertyupdate xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">',
          '  <D:set><D:prop><C:calendar-color>#ff0000</C:calendar-color></D:prop></D:set>',
          '</D:propertyupdate>'
        ].join('')
      }),
      { method: 'PROPPATCH', pathname: '/caldav/calendars/owner/' },
      { database, prepared }
    )
    expect(propPatch.status).toBe(207)
    expect(await propPatch.text()).toContain('<C:calendar-color>')

    const home = await handleCalDav(
      new Request('http://localhost/caldav/calendars/owner/', {
        method: 'PROPFIND',
        headers: { ...basicAuth(), Depth: '1' }
      }),
      { method: 'PROPFIND', pathname: '/caldav/calendars/owner/' },
      { database, prepared }
    )
    expect(home.status).toBe(207)
    const homeBody = await home.text()
    expect(homeBody).toContain('<D:href>/caldav/calendars/owner/</D:href>')
    expect(homeBody).toContain('<D:resourcetype><D:collection/></D:resourcetype>')
    expect(homeBody).toContain('<D:displayname>Timeline</D:displayname>')
    expect(homeBody).toContain('<IC:calendar-color>#FF5C8A</IC:calendar-color>')
    expect(homeBody).toContain('<C:supported-calendar-component-set><C:comp name="VEVENT"/></C:supported-calendar-component-set>')
    expect(homeBody).toContain('<D:href>/caldav/calendars/owner/meetings/</D:href>')
    expect(homeBody).toContain('<D:href>/caldav/calendars/owner/travel/</D:href>')
    expect(homeBody).toContain('<D:href>/caldav/calendars/owner/dating/</D:href>')
    expect(homeBody).toContain('<D:href>/caldav/calendars/owner/anniversary/</D:href>')
    expect(homeBody).toContain('<D:displayname>见面</D:displayname>')
    expect(homeBody).toContain('<D:displayname>旅行</D:displayname>')
    expect(homeBody).toContain('<D:displayname>约会</D:displayname>')
    expect(homeBody).toContain('<D:displayname>纪念日</D:displayname>')
    expect(homeBody).toContain('<D:href>/caldav/calendars/owner/birthday/</D:href>')
    expect(homeBody).toContain('<D:displayname>生日</D:displayname>')

    const homeDepthZero = await handleCalDav(
      new Request('http://localhost/caldav/calendars/owner/', {
        method: 'PROPFIND',
        headers: { ...basicAuth(), Depth: '0' }
      }),
      { method: 'PROPFIND', pathname: '/caldav/calendars/owner/' },
      { database, prepared }
    )
    expect(homeDepthZero.status).toBe(207)
    const homeDepthZeroBody = await homeDepthZero.text()
    expect(homeDepthZeroBody).toContain('<D:resourcetype><D:collection/></D:resourcetype>')
    expect(homeDepthZeroBody).not.toContain('<D:href>/caldav/calendars/owner/timeline/</D:href>')

    const timelineCollection = await handleCalDav(
      new Request('http://localhost/caldav/calendars/owner/timeline/', {
        method: 'PROPFIND',
        headers: { ...basicAuth(), Depth: '0' }
      }),
      { method: 'PROPFIND', pathname: '/caldav/calendars/owner/timeline/' },
      { database, prepared }
    )
    expect(timelineCollection.status).toBe(207)
    const timelineBody = await timelineCollection.text()
    expect(timelineBody).toContain('<D:resourcetype><D:collection/><C:calendar/></D:resourcetype>')
    expect(timelineBody).toContain('<C:supported-calendar-component-set>')
    expect(timelineBody).toContain('<D:privilege><D:read/></D:privilege>')
    expect(timelineBody).toContain('<D:privilege><D:write/></D:privilege>')
    expect(timelineBody).toContain('<C:calendar-multiget/>')

    const requestedTimelineCollection = await handleCalDav(
      new Request('http://localhost/caldav/calendars/owner/timeline/', {
        method: 'PROPFIND',
        headers: { ...basicAuth(), Depth: '0', 'Content-Type': 'application/xml' },
        body: [
          '<?xml version="1.0" encoding="utf-8"?>',
          '<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">',
          '  <D:prop><D:resourcetype><D:collection/></D:resourcetype><C:supported-calendar-component-set/></D:prop>',
          '</D:propfind>'
        ].join('')
      }),
      { method: 'PROPFIND', pathname: '/caldav/calendars/owner/timeline/' },
      { database, prepared }
    )
    const requestedTimelineBody = await requestedTimelineCollection.text()
    expect(requestedTimelineBody).toContain('<D:resourcetype><D:collection/><C:calendar/></D:resourcetype>')
    expect(requestedTimelineBody).toContain('<C:supported-calendar-component-set>')
    expect(requestedTimelineBody).not.toContain('<D:displayname>')
    expect(requestedTimelineBody).not.toContain('<CS:getctag>')

    const collection = await handleCalDav(
      new Request('http://localhost/caldav/calendars/owner/', {
        method: 'PROPFIND',
        headers: { ...basicAuth(), Depth: '1' }
      }),
      { method: 'PROPFIND', pathname: '/caldav/calendars/owner/' },
      { database, prepared }
    )
    expect(collection.status).toBe(207)
    const collectionBody = await collection.text()
    expect(collectionBody).toContain('<D:href>/caldav/calendars/owner/</D:href>')
    expect(collectionBody).toContain('<D:resourcetype><D:collection/><C:calendar/></D:resourcetype>')
    expect(collectionBody).toContain('<D:current-user-principal>')
    expect(collectionBody).toContain('<D:principal-URL>')
    expect(collectionBody).toContain('<C:calendar-home-set>')
    expect(collectionBody).toContain('<D:displayname>Timeline</D:displayname>')
    expect(collectionBody).toContain('/caldav/principal/owner/')

    const shortHome = await handleCalDav(
      new Request('http://localhost/caldav/owner/', {
        method: 'PROPFIND',
        headers: { ...basicAuth(), Depth: '1' }
      }),
      { method: 'PROPFIND', pathname: '/caldav/owner/' },
      { database, prepared }
    )
    expect(shortHome.status).toBe(207)
    expect(await shortHome.text()).toContain('<D:resourcetype><D:collection/><C:calendar/></D:resourcetype>')

    const shortCollection = await handleCalDav(
      new Request('http://localhost/caldav/owner/timeline/', {
        method: 'PROPFIND',
        headers: { ...basicAuth(), Depth: '1' }
      }),
      { method: 'PROPFIND', pathname: '/caldav/owner/timeline/' },
      { database, prepared }
    )
    expect(shortCollection.status).toBe(207)
    expect(await shortCollection.text()).toContain('legacy@timeline')

    const eventBody = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'UID:new-event@calendar',
      'SUMMARY:Dinner',
      'DTSTART;VALUE=DATE:20260910',
      'DTEND;VALUE=DATE:20260911',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n')
    const created = await handleCalDav(
      new Request('http://localhost/caldav/calendars/owner/new-event%40calendar.ics', {
        method: 'PUT',
        headers: { ...basicAuth(), 'Content-Type': 'text/calendar' },
        body: eventBody
      }),
      { method: 'PUT', pathname: '/caldav/calendars/owner/new-event%40calendar.ics' },
      { database, prepared }
    )
    expect(created.status).toBe(201)
    expect(prepared.getCalDavMeetings.all().map(row => row.date)).toContain('2026-09-10')

    const travelEvent = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'UID:travel-event@calendar',
      'SUMMARY:Trip',
      'DTSTART;VALUE=DATE:20260910',
      'DTEND;VALUE=DATE:20260911',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n')
    const travelCreated = await handleCalDav(
      new Request('http://localhost/caldav/calendars/owner/travel/travel-event%40calendar.ics', {
        method: 'PUT',
        headers: { ...basicAuth(), 'Content-Type': 'text/calendar' },
        body: travelEvent
      }),
      { method: 'PUT', pathname: '/caldav/calendars/owner/travel/travel-event%40calendar.ics' },
      { database, prepared }
    )
    expect(travelCreated.status).toBe(201)
    expect(prepared.getCalDavMeetings.all().find(row => row.uid === 'travel-event@calendar').category).toBe('travel')

    const travelReport = await handleCalDav(
      new Request('http://localhost/caldav/calendars/owner/travel/', {
        method: 'REPORT',
        headers: basicAuth(),
        body: '<C:calendar-query xmlns:C="urn:ietf:params:xml:ns:caldav"/>'
      }),
      { method: 'REPORT', pathname: '/caldav/calendars/owner/travel/' },
      { database, prepared }
    )
    expect(travelReport.status).toBe(207)
    const travelReportBody = await travelReport.text()
    expect(travelReportBody).toContain('travel-event%40calendar.ics')
    expect(travelReportBody).not.toContain('new-event%40calendar.ics')

    const updatedBody = eventBody.replace('SUMMARY:Dinner', 'SUMMARY:Dinner\\, movie')
    const updated = await handleCalDav(
      new Request('http://localhost/caldav/calendars/owner/new-event%40calendar.ics', {
        method: 'PUT',
        headers: { ...basicAuth(), 'Content-Type': 'text/calendar' },
        body: updatedBody
      }),
      { method: 'PUT', pathname: '/caldav/calendars/owner/new-event%40calendar.ics' },
      { database, prepared }
    )
    expect(updated.status).toBe(204)
    expect(prepared.getCalDavMeetings.all().find(row => row.uid === 'new-event@calendar').note).toBe('Dinner, movie')

    const fetchedEvent = await handleCalDav(
      new Request('http://localhost/caldav/calendars/owner/new-event%40calendar.ics', {
        headers: basicAuth()
      }),
      { method: 'GET', pathname: '/caldav/calendars/owner/new-event%40calendar.ics' },
      { database, prepared }
    )
    expect(fetchedEvent.status).toBe(200)
    const fetchedEventBody = await fetchedEvent.text()
    expect(fetchedEventBody).toContain('BEGIN:VCALENDAR')
    expect(fetchedEventBody).toContain('END:VCALENDAR')
    expect(fetchedEventBody).toContain('SUMMARY:见面：Dinner\\, movie')
    expect(fetchedEventBody).not.toContain('METHOD:')

    const multiget = await handleCalDav(
      new Request('http://localhost/caldav/calendars/owner/', {
        method: 'REPORT',
        headers: { ...basicAuth(), 'Content-Type': 'application/xml' },
        body: [
          '<?xml version="1.0" encoding="utf-8"?>',
          '<C:calendar-multiget xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">',
          '  <D:href>/caldav/calendars/owner/new-event%40calendar.ics</D:href>',
          '</C:calendar-multiget>'
        ].join('\r\n')
      }),
      { method: 'REPORT', pathname: '/caldav/calendars/owner/timeline/' },
      { database, prepared }
    )
    expect(multiget.status).toBe(207)
    const multigetBody = await multiget.text()
    expect(multigetBody).toContain('new-event%40calendar.ics')
    expect(multigetBody).toContain('/caldav/calendars/owner/timeline/')

    const legacyMultiget = await handleCalDav(
      new Request('http://localhost/caldav/calendars/owner/', {
        method: 'REPORT',
        headers: { ...basicAuth(), 'Content-Type': 'application/xml' },
        body: [
          '<?xml version="1.0" encoding="utf-8"?>',
          '<C:calendar-multiget xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">',
          '  <D:href>/caldav/calendars/owner/new-event%40calendar.ics</D:href>',
          '</C:calendar-multiget>'
        ].join('\r\n')
      }),
      { method: 'REPORT', pathname: '/caldav/calendars/owner/' },
      { database, prepared }
    )
    expect(legacyMultiget.status).toBe(207)
    expect(await legacyMultiget.text()).toContain('new-event%40calendar.ics')

    const deleted = await handleCalDav(
      new Request('http://localhost/caldav/calendars/owner/new-event%40calendar.ics', {
        method: 'DELETE',
        headers: basicAuth()
      }),
      { method: 'DELETE', pathname: '/caldav/calendars/owner/new-event%40calendar.ics' },
      { database, prepared }
    )
    expect(deleted.status).toBe(204)
    expect(prepared.getCalDavMeetings.all().some(row => row.uid === 'new-event@calendar')).toBe(false)
  })
})
