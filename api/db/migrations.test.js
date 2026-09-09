import { describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { runMigrations } from './migrations.js'

describe('database migrations', () => {
  test('applies migrations in dependency order', () => {
    const database = new Database(':memory:')
    runMigrations(database)

    expect(database.query('SELECT version FROM _migrations ORDER BY rowid').all()).toEqual([
      { version: 1 },
      { version: 2 },
      { version: 3 },
      { version: 4 }
    ])

    const userColumns = database.query('PRAGMA table_info(users)').all().map(column => column.name)
    const meetingColumns = database.query('PRAGMA table_info(meetings)').all().map(column => column.name)
    const sessionColumns = database.query('PRAGMA table_info(sessions)').all().map(column => column.name)
    const subscriptionColumns = database.query('PRAGMA table_info(calendar_subscriptions)').all()
      .map(column => column.name)

    expect(userColumns).toContain('role')
    expect(meetingColumns).toContain('uid')
    expect(sessionColumns).toContain('user_id')
    expect(subscriptionColumns).toContain('user_id')
  })
})
