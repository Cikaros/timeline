// 所有SQL语句集中管理，便于维护和优化
export const statements = {
  // 设置相关
  getSetting: 'SELECT value FROM settings WHERE key = ?',
  setSetting: 'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)',

  // 会话相关
  createSession: 'INSERT INTO sessions (token, expires, user_id) VALUES (?, ?, ?)',
  getSession: 'SELECT sessions.expires, sessions.user_id, users.username FROM sessions LEFT JOIN users ON users.id = sessions.user_id WHERE sessions.token = ?',
  deleteSession: 'DELETE FROM sessions WHERE token = ?',
  deleteAllSessions: 'DELETE FROM sessions',
  deleteAllSessionsExcept: 'DELETE FROM sessions WHERE token != ?',
  deleteSessionsByUser: 'DELETE FROM sessions WHERE user_id = ?',
  deleteSessionsByUserExcept: 'DELETE FROM sessions WHERE user_id = ? AND token != ?',
  assignUnownedSessions: 'UPDATE OR IGNORE sessions SET user_id = ? WHERE user_id IS NULL',
  cleanupExpiredSessions: 'DELETE FROM sessions WHERE expires < ?',

  // 账号相关
  getUserCount: 'SELECT COUNT(*) as count FROM users',
  getUsers: 'SELECT id, username, role, created_at, updated_at FROM users ORDER BY created_at ASC, id ASC',
  getUserById: 'SELECT id, username, role, password_hash, created_at, updated_at FROM users WHERE id = ?',
  getUserByUsername: 'SELECT id, username, role, password_hash, created_at, updated_at FROM users WHERE username = ?',
  insertUser: 'INSERT INTO users (username, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?)',
  updateUserRole: 'UPDATE users SET role = ?, updated_at = ? WHERE id = ?',
  updateUserPassword: 'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?',
  deleteUser: 'DELETE FROM users WHERE id = ?',
  deleteCalendarSubscriptionsByUser: 'DELETE FROM calendar_subscriptions WHERE user_id = ?',

  // 见面相关
  getMeetingCount: 'SELECT COUNT(*) as count FROM meetings',
  getMeetingCountByCategory: 'SELECT COUNT(*) as count FROM meetings WHERE category = ?',
  getMeetings: 'SELECT id, date, note, category, created_at FROM meetings ORDER BY date DESC, id DESC LIMIT ? OFFSET ?',
  getMeetingsByCategory: 'SELECT id, date, note, category, created_at FROM meetings WHERE category = ? ORDER BY date DESC, id DESC LIMIT ? OFFSET ?',
  getMeetingByDate: 'SELECT id FROM meetings WHERE date = ? AND category = ?',
  insertMeeting: 'INSERT INTO meetings (date, note, uid, updated_at, category) VALUES (?, ?, ?, ?, ?)',
  updateMeetingNote: 'UPDATE meetings SET note = ?, category = ?, updated_at = ? WHERE id = ?',
  deleteMeeting: 'DELETE FROM meetings WHERE id = ?',
  getIcsMeetings: 'SELECT id, date, note, uid, updated_at, category FROM meetings WHERE date <= ? ORDER BY date ASC, id ASC',
  getCalDavMeetings: 'SELECT id, date, note, uid, updated_at, category FROM meetings ORDER BY date ASC, id ASC',
  getCalDavMeetingsByCategory: 'SELECT id, date, note, uid, updated_at, category FROM meetings WHERE category = ? ORDER BY date ASC, id ASC',
  getCalDavMeetingsByUid: 'SELECT id, date, note, uid, updated_at FROM meetings WHERE uid = ? ORDER BY date ASC, id ASC',
  getCalDavMeetingById: 'SELECT id, date, note, uid, updated_at FROM meetings WHERE id = ?',
  deleteMeetingsByUid: 'DELETE FROM meetings WHERE uid = ?',

  // 日历订阅相关
  getCalendarSubscriptionCount: 'SELECT COUNT(*) as count FROM calendar_subscriptions',
  getCalendarSubscriptions: 'SELECT id, name, token, enabled, access_count, last_accessed_at, created_at, updated_at FROM calendar_subscriptions ORDER BY created_at DESC, id DESC',
  getCalendarSubscriptionsByUser: 'SELECT id, name, token, enabled, access_count, last_accessed_at, created_at, updated_at FROM calendar_subscriptions WHERE user_id = ? ORDER BY created_at DESC, id DESC',
  getCalendarSubscriptionById: 'SELECT id, name, token, enabled, access_count, last_accessed_at, created_at, updated_at FROM calendar_subscriptions WHERE id = ?',
  getCalendarSubscriptionByToken: 'SELECT id, name, token, enabled, access_count, last_accessed_at, created_at, updated_at FROM calendar_subscriptions WHERE token = ?',
  insertCalendarSubscription: 'INSERT INTO calendar_subscriptions (name, token, enabled, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
  assignUnownedCalendarSubscriptions: 'UPDATE OR IGNORE calendar_subscriptions SET user_id = ? WHERE user_id IS NULL',
  updateCalendarSubscription: 'UPDATE calendar_subscriptions SET name = ?, enabled = ?, updated_at = ? WHERE id = ?',
  deleteCalendarSubscription: 'DELETE FROM calendar_subscriptions WHERE id = ?',
  touchCalendarSubscription: 'UPDATE calendar_subscriptions SET access_count = access_count + 1, last_accessed_at = ? WHERE id = ?'
}
