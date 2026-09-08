import { describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { getIcsContent } from './ics.service.js'

function createTestDb() {
  const database = new Database(':memory:')
  database.run(`CREATE TABLE calendar_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    enabled INTEGER NOT NULL DEFAULT 1,
    access_count INTEGER NOT NULL DEFAULT 0,
    last_accessed_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`)
  database.run('CREATE TABLE meetings (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL UNIQUE, note TEXT)')

  return database
}

describe('getIcsContent', () => {
  test('generates valid all-day ICS events with escaped notes', async () => {
    const database = createTestDb()
    database.run("INSERT INTO calendar_subscriptions (name, token, enabled, created_at, updated_at) VALUES ('手机日历', 'token-1', 1, 1, 1)")
    database.run("INSERT INTO meetings (date, note) VALUES ('2026-02-28', '吃午饭, 看电影; 引号\\内容')")
    database.run("INSERT INTO meetings (date, note) VALUES ('2026-12-31', '跨年')")

    const prepared = {
      getCalendarSubscriptionByToken: database.prepare('SELECT * FROM calendar_subscriptions WHERE token = ?'),
      getIcsMeetings: database.prepare('SELECT id, date, note FROM meetings WHERE date <= ? ORDER BY date ASC')
    }

    const result = await getIcsContent('token-1', { prepared })
    expect(result).not.toBeNull()
    expect(result.content).toContain('BEGIN:VCALENDAR\r\n')
    expect(result.content).toContain('VERSION:2.0\r\n')
    expect(result.content).toContain('X-WR-CALNAME:Timeline\r\n')
    expect(result.content).toContain('UID:1@timeline\r\n')
    expect(result.content).toContain('DTSTART;VALUE=DATE:20260228\r\n')
    expect(result.content).toContain('DTEND;VALUE=DATE:20260301\r\n')
    expect(result.content).toContain('SUMMARY:见面：吃午饭\\, 看电影\\; 引号\\\\内容\r\n')
    expect(result.content.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(result.content.replace(/\r\n/g, '').includes('\n')).toBe(false)
  })

  test('rejects disabled subscriptions', async () => {
    const database = createTestDb()
    database.run("INSERT INTO calendar_subscriptions (name, token, enabled, created_at, updated_at) VALUES ('手机日历', 'token-off', 0, 1, 1)")

    const prepared = {
      getCalendarSubscriptionByToken: database.prepare('SELECT * FROM calendar_subscriptions WHERE token = ?'),
      getIcsMeetings: database.prepare('SELECT id, date, note FROM meetings WHERE date <= ?')
    }

    const result = await getIcsContent('token-off', { prepared })
    expect(result).toBeNull()
  })
})
