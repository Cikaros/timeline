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

// 迁移版本必须从 2 开始继续递增。
migrations.push({
  version: 2,
  description: '新增日历订阅链接表',
  up: [
    `CREATE TABLE IF NOT EXISTS calendar_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
      access_count INTEGER NOT NULL DEFAULT 0,
      last_accessed_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    )`,
    'CREATE INDEX IF NOT EXISTS idx_calendar_subscriptions_token ON calendar_subscriptions(token)',
  ],
})

migrations.push({
  version: 4,
  description: '为账号增加管理员角色',
  up: [
    "ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'",
    "UPDATE users SET role = 'admin' WHERE username = 'owner'",
    'CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)',
  ],
})

migrations.push({
  version: 3,
  description: '新增账号与 CalDAV 同步字段',
  up: [
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    )`,
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)',
    'ALTER TABLE sessions ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE',
    'ALTER TABLE calendar_subscriptions ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE',
    'ALTER TABLE meetings ADD COLUMN uid TEXT',
    'ALTER TABLE meetings ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0',
    'UPDATE meetings SET updated_at = CAST(strftime("%s", "now") AS INTEGER) * 1000 WHERE updated_at = 0',
    'CREATE INDEX IF NOT EXISTS idx_meetings_uid ON meetings(uid)',
    'CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_calendar_subscriptions_user_id ON calendar_subscriptions(user_id)',
  ],
})

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
