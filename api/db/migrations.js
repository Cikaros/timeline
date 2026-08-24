/**
 * 版本化数据库迁移系统
 * 每个迁移包含 version、description 和 up（SQL 语句数组）
 */
const migrations = [
  {
    version: 1,
    description: '初始表结构',
    up: [
      `CREATE TABLE IF NOT EXISTS meetings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL UNIQUE,
        note TEXT,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
      )`,
      `CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
      )`,
      `CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        expires INTEGER NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
      )`,
      'CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings(date)',
      'CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires)',
    ],
  },
]

/**
 * 执行数据库迁移
 * @param {import('bun:sqlite').Database} db
 */
export function runMigrations(db) {
  // 创建迁移记录表
  db.run(`CREATE TABLE IF NOT EXISTS _migrations (
    version INTEGER PRIMARY KEY,
    description TEXT,
    applied_at INTEGER NOT NULL
  )`)

  const current = db.query('SELECT MAX(version) as v FROM _migrations').get()?.v || 0

  for (const migration of migrations) {
    if (migration.version > current) {
      db.transaction(() => {
        for (const sql of migration.up) {
          db.run(sql)
        }
        db.run(
          'INSERT INTO _migrations (version, description, applied_at) VALUES (?, ?, ?)',
          [migration.version, migration.description, Date.now()]
        )
      })()
      console.log(`✅ 迁移 v${migration.version}: ${migration.description}`)
    }
  }
}
