import Database from 'bun:sqlite'
import { CONFIG } from '../config/index.js'
import { statements } from './statements.js'
import { mkdir } from "node:fs/promises";

// 确保数据目录存在
await mkdir("data", { recursive: true })

// 初始化数据库连接
export const db = new Database(CONFIG.DB_PATH)

// SQLite性能与安全配置
db.run('PRAGMA journal_mode = WAL;')
db.run('PRAGMA synchronous = NORMAL;')
db.run('PRAGMA foreign_keys = ON;')
db.run('PRAGMA temp_store = MEMORY;')
db.run('PRAGMA cache_size = -20000;') // 20MB缓存

// 初始化数据表（必须在预编译语句之前执行）
function initializeTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS meetings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      note TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    );
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    );
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      expires INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    );
  `)

  // 创建索引
  db.run('CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings(date);')
  db.run('CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires);')
}

// ✅ 关键修复：先创建表，再预编译语句
initializeTables()
console.log('✅ 数据库表初始化完成')

// 预编译所有SQL语句（必须在表创建之后）
export const preparedStatements = {}
for (const [name, sql] of Object.entries(statements)) {
  preparedStatements[name] = db.prepare(sql)
}
console.log('✅ SQL语句预编译完成')

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n🛑 正在关闭数据库连接...')
  db.close()
  process.exit(0)
})