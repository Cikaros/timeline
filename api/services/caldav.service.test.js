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
    date TEXT NOT NULL UNIQUE,
    note TEXT,
    created_at INTEGER NOT NULL DEFAULT 0,
    uid TEXT,
    updated_at INTEGER NOT NULL
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
    getCalDavMeetings: database.prepare('SELECT id, date, note, uid, updated_at FROM meetings ORDER BY date ASC, id ASC'),
    getCalDavMeetingsByUid: database.prepare('SELECT id, date, note, uid, updated_at FROM meetings WHERE uid = ? ORDER BY date ASC, id ASC'),
    getCalDavMeetingById: database.prepare('SELECT id, date, note, uid, updated_at FROM meetings WHERE id = ?'),
    getMeetingByDate: database.prepare('SELECT id FROM meetings WHERE date = ?'),
    insertMeeting: database.prepare('INSERT INTO meetings (date, note, uid, updated_at) VALUES (?, ?, ?, ?)'),
    updateMeetingNote: database.prepare('UPDATE meetings SET note = ?, updated_at = ? WHERE id = ?'),
    deleteMeeting: database.prepare('DELETE FROM meetings WHERE id = ?'),
    deleteMeetingsByUid: database.prepare('DELETE FROM meetings WHERE uid = ?'),
    getIcsMeetings: database.prepare('SELECT id, date, note, uid, updated_at FROM meetings WHERE date <= ? ORDER BY date ASC, id ASC'),
  }

  return { database, prepared }
}

function basicAuth() {
  return { authorization: `Basic ${btoa('owner:secret')}` }
}

describe('CalDAV service', () => {
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
    prepared.insertMeeting.run('2026-09-01', 'Old', 'legacy@timeline', 1)

    const context = { method: 'PROPFIND', pathname: '/caldav/' }
    const discovery = await handleCalDav(
      new Request('http://localhost/caldav/', { headers: basicAuth() }),
      context,
      { database, prepared }
    )
    expect(discovery.status).toBe(207)
    expect(await discovery.text()).toContain('current-user-principal')

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
    expect(collectionBody).toContain('legacy@timeline')
    expect(collectionBody).toContain('<D:current-user-principal>')
    expect(collectionBody).toContain('<D:principal-URL>')
    expect(collectionBody).toContain('/caldav/principal/owner/')

    const shortCollection = await handleCalDav(
      new Request('http://localhost/caldav/owner/', {
        method: 'PROPFIND',
        headers: { ...basicAuth(), Depth: '1' }
      }),
      { method: 'PROPFIND', pathname: '/caldav/owner/' },
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
      { method: 'REPORT', pathname: '/caldav/calendars/owner/' },
      { database, prepared }
    )
    expect(multiget.status).toBe(207)
    expect(await multiget.text()).toContain('new-event%40calendar.ics')

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
