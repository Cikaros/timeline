# 数据库设计文档

## 技术栈

- **数据库引擎**: SQLite（通过 `bun:sqlite` 驱动）
- **存储路径**: `./data/timeline.db`（受 `DB_PATH` 环境变量控制）
- **存储模式**: WAL（Write-Ahead Logging）
- **迁移系统**: 版本化迁移，记录于 `_migrations` 表

## 存储配置

```javascript
// api/db/index.js
// 性能与隔离性 PRAGMA
PRAGMA journal_mode = WAL;          // WAL 模式，并发读写不阻塞
PRAGMA synchronous = NORMAL;        // 正常同步，平衡性能与安全
PRAGMA foreign_keys = ON;           // 外键约束（暂未使用）
PRAGMA temp_store = MEMORY;         // 临时对象存于内存
PRAGMA cache_size = -20000;         // 缓存 20000 页（约 800KB）
PRAGMA busy_timeout = 5000;         // 数据库繁忙时等待 5 秒
```

## 表结构

### 1. meetings（见面记录）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | 自增主键 |
| `date` | TEXT | NOT NULL, UNIQUE | 见面日期（YYYY-MM-DD 格式） |
| `note` | TEXT | | 备注信息 |
| `created_at` | INTEGER | NOT NULL | 创建时间戳（秒） |

```sql
CREATE TABLE IF NOT EXISTS meetings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  note TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);
CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings(date);
```

### 2. settings（应用设置）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `key` | TEXT | PRIMARY KEY | 设置键名（如 `password_hash`） |
| `value` | TEXT | NOT NULL | 设置值（加密后的字符串） |
| `updated_at` | INTEGER | NOT NULL | 更新时间戳（秒） |

```sql
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);
```

### 3. sessions（会话）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `token` | TEXT | PRIMARY KEY | UUID 格式会话标识 |
| `expires` | INTEGER | NOT NULL | 过期时间戳（秒） |
| `created_at` | INTEGER | NOT NULL | 创建时间戳（秒） |

```sql
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  expires INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires);
```

### 4. _migrations（迁移日志）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `version` | INTEGER | PRIMARY KEY | 迁移版本号（自增） |
| `description` | TEXT | | 迁移描述 |
| `applied_at` | INTEGER | NOT NULL | 执行时间戳（秒） |

```sql
CREATE TABLE IF NOT EXISTS _migrations (
  version INTEGER PRIMARY KEY,
  description TEXT,
  applied_at INTEGER NOT NULL
);
```

## 预编译 SQL 语句

所有 SQL 在应用启动时集中预编译，避免运行时解析开销：

```javascript
// api/db/statements.js
statements = {
  // 设置相关
  getSetting: 'SELECT value FROM settings WHERE key = ?',
  setSetting: 'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)',

  // 会话相关
  createSession: 'INSERT INTO sessions (token, expires) VALUES (?, ?)',
  getSession: 'SELECT expires FROM sessions WHERE token = ?',
  deleteSession: 'DELETE FROM sessions WHERE token = ?',
  deleteAllSessions: 'DELETE FROM sessions',
  deleteAllSessionsExcept: 'DELETE FROM sessions WHERE token != ?',
  cleanupExpiredSessions: 'DELETE FROM sessions WHERE expires < ?',

  // 见面相关
  getMeetingCount: 'SELECT COUNT(*) as count FROM meetings',
  getMeetings: 'SELECT id, date, note, created_at FROM meetings ORDER BY date DESC, id DESC LIMIT ? OFFSET ?',
  getMeetingByDate: 'SELECT id FROM meetings WHERE date = ?',
  insertMeeting: 'INSERT INTO meetings (date, note) VALUES (?, ?)',
  updateMeetingNote: 'UPDATE meetings SET note = ? WHERE id = ?',
  deleteMeeting: 'DELETE FROM meetings WHERE id = ?'
}
```

## 迁移流程

```javascript
// api/db/migrations.js
const migrations = [
  {
    version: 1,
    description: '初始表结构',
    up: [
      // CREATE TABLE IF NOT EXISTS meetings ...
      // CREATE TABLE IF NOT EXISTS settings ...
      // CREATE TABLE IF NOT EXISTS sessions ...
      // CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings(date)
      // CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires)
    ]
  }
]

export function runMigrations(db) {
  // 创建迁移日志表
  db.run(`CREATE TABLE IF NOT EXISTS _migrations (
    version INTEGER PRIMARY KEY,
    description TEXT,
    applied_at INTEGER NOT NULL
  )`)

  const current = db.query('SELECT MAX(version) as v FROM _migrations').get()?.v || 0

  for (const migration of migrations) {
    if (migration.version > current) {
      // 事务性应用
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
```

## 配置项

```javascript
// api/config/index.js
export const CONFIG = {
  PORT: Number(process.env.PORT) || 3000,
  DB_PATH: process.env.DB_PATH || './data/timeline.db',
  SESSION_DURATION: Number(process.env.SESSION_DURATION) || 24 * 60 * 60 * 1000,
  SESSION_CLEANUP_INTERVAL: 6 * 60 * 60 * 1000,
  STATIC_CACHE_MAX_AGE: 31536000,
  MAX_REQUEST_BODY_SIZE: 1024 * 1024,
  DEFAULT_PASSWORD: process.env.DEFAULT_PASSWORD || 'REDACTED'
}
```

| 配置项 | 说明 |
|--------|------|
| `DB_PATH` | 数据库文件路径（默认 `./data/timeline.db`） |
| `SESSION_DURATION` | 会话有效期（默认 24 小时） |
| `SESSION_CLEANUP_INTERVAL` | 过期会话清理间隔（默认 6 小时） |

## 环境变量

| 变量 | 说明 |
|------|------|
| `DB_PATH` | 数据库文件路径 |
| `PORT` | 后端服务端口（默认 3000） |
| `SESSION_DURATION` | 会话有效期（毫秒） |
| `DEFAULT_PASSWORD` | 默认登录密码 |

## 存储位置

- **生产**: `./data/timeline.db`
- **Docker**: Docker 通过 `./data:/app/data` 挂载，实时同步

## 示例表结构（输出）

```sql
-- meetings
┌─────────┬──────┬─────────┬─────────┬─────────────┐
│  Field  │ Type │   Key  │     Null │    Default  │
├─────────┼──────┼─────────┼─────────┼─────────────┤
│    id   │ int  │ PRI,K   │   NO    │  auto-inc   │
│  date   │ text │ UNI     │   NO    │             │
│  note   │ text │         │   YES   │             │
│created_at│ int  │         │   NO    │    expr     │
└─────────┴──────┴─────────┴─────────┴─────────────┘

-- settings
┌─────────┬──────┬─────────┬─────────┬─────────────┐
│  Field  │ Type │   Key  │     Null │    Default  │
├─────────┼──────┼─────────┼─────────┼─────────────┤
│   key   │ text │ PRI     │   NO    │             │
│ value   │ text │         │   NO    │             │
│updated_at│ int  │         │   NO    │    expr     │
└─────────┴──────┴─────────┴─────────┴─────────────┘

-- sessions
┌─────────┬──────┬─────────┬─────────┬─────────────┐
│  Field  │ Type │   Key  │     Null │    Default  │
├─────────┼──────┼─────────┼─────────┼─────────────┤
│ token   │ text │ PRI     │   NO    │             │
│ expires │ int  │         │   NO    │             │
│created_at│ int  │         │   NO    │    expr     │
└─────────┴──────┴─────────┴─────────┴─────────────┘

-- _migrations
┌─────────┬──────┬─────────┬─────────┬─────────────┐
│  Field  │ Type │   Key  │     Null │    Default  │
├─────────┼──────┼─────────┼─────────┼─────────────┤
│ version │ int  │ PRI     │   NO    │             │
│ description │ text │         │   YES   │             │
│applied_at│ int  │         │   NO    │             │
└─────────┴──────┴─────────┴─────────┴─────────────┘
```
