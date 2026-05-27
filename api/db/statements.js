// 所有SQL语句集中管理，便于维护和优化
export const statements = {
  // 设置相关
  getSetting: 'SELECT value FROM settings WHERE key = ?',
  setSetting: 'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)',

  // 会话相关
  createSession: 'INSERT INTO sessions (token, expires) VALUES (?, ?)',
  getSession: 'SELECT expires FROM sessions WHERE token = ?',
  deleteSession: 'DELETE FROM sessions WHERE token = ?',
  deleteAllSessions: 'DELETE FROM sessions',
  cleanupExpiredSessions: 'DELETE FROM sessions WHERE expires < ?',

  // 见面相关
  getMeetingCount: 'SELECT COUNT(*) as count FROM meetings',
  getMeetings: 'SELECT id, date, note, created_at FROM meetings ORDER BY date DESC, id DESC LIMIT ? OFFSET ?',
  getMeetingByDate: 'SELECT id FROM meetings WHERE date = ?',
  insertMeeting: 'INSERT INTO meetings (date, note) VALUES (?, ?)',
  updateMeetingNote: 'UPDATE meetings SET note = ? WHERE id = ?',
  deleteMeeting: 'DELETE FROM meetings WHERE id = ?',
  clearAllMeetings: 'DELETE FROM meetings'
}