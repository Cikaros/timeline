import { describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'

function createTestDb() {
  const database = new Database(':memory:')
  database.run(`CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`)
  database.run('CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL)')
  database.run('CREATE TABLE sessions (token TEXT PRIMARY KEY, expires INTEGER NOT NULL, created_at INTEGER NOT NULL DEFAULT 0, user_id INTEGER)')
  database.run('CREATE TABLE calendar_subscriptions (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, token TEXT NOT NULL, user_id INTEGER)')

  const prepared = {
    getSetting: database.prepare('SELECT value FROM settings WHERE key = ?'),
    setSetting: database.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)'),
    getUserCount: database.prepare('SELECT COUNT(*) as count FROM users'),
    getUsers: database.prepare('SELECT id, username, role, created_at, updated_at FROM users ORDER BY created_at ASC, id ASC'),
    getUserById: database.prepare('SELECT id, username, role, password_hash, created_at, updated_at FROM users WHERE id = ?'),
    getUserByUsername: database.prepare('SELECT id, username, role, password_hash, created_at, updated_at FROM users WHERE username = ?'),
    insertUser: database.prepare('INSERT INTO users (username, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?)'),
    updateUserRole: database.prepare('UPDATE users SET role = ?, updated_at = ? WHERE id = ?'),
    updateUserPassword: database.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?'),
    deleteUser: database.prepare('DELETE FROM users WHERE id = ?'),
    createSession: database.prepare('INSERT INTO sessions (token, expires, user_id) VALUES (?, ?, ?)'),
    deleteSessionsByUser: database.prepare('DELETE FROM sessions WHERE user_id = ?'),
    deleteSessionsByUserExcept: database.prepare('DELETE FROM sessions WHERE user_id = ? AND token != ?'),
    assignUnownedSessions: database.prepare('UPDATE OR IGNORE sessions SET user_id = ? WHERE user_id IS NULL'),
    deleteCalendarSubscriptionsByUser: database.prepare('DELETE FROM calendar_subscriptions WHERE user_id = ?'),
    assignUnownedCalendarSubscriptions: database.prepare('UPDATE OR IGNORE calendar_subscriptions SET user_id = ? WHERE user_id IS NULL')
  }

  return { database, prepared }
}

describe('users service', () => {
  test('initializes one owner account and enforces the global limit', async () => {
    const { CONFIG } = await import('../config/index.js')
    const { initializeDefaultAccount, login, createAccount, deleteAccount } =
      await import('./users.service.js')

    CONFIG.DEFAULT_PASSWORD ||= 'test-initial-password'

    const { database, prepared } = createTestDb()
    await initializeDefaultAccount({ database, prepared })
    expect(prepared.getUsers.all()).toHaveLength(1)
    expect(prepared.getUsers.all()[0].username).toBe('owner')
    expect(prepared.getUsers.all()[0].role).toBe('admin')

    const loginResult = await login('owner', 'test-initial-password', { database, prepared })
    expect(loginResult.user.username).toBe('owner')

    await createAccount('second', 'secret-password', { database, prepared })
    expect(prepared.getUsers.all()).toHaveLength(2)
    await expect(createAccount('third', 'secret-password', { database, prepared })).rejects.toThrow('全局最多只能创建2个账号')

    const secondAccount = prepared.getUserByUsername.get('second')
    expect(deleteAccount(secondAccount.id, { database, prepared })).toBe(true)
    expect(() => deleteAccount(1, { database, prepared })).toThrow('管理员账号不允许删除')
  })
})
