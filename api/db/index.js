import Database from 'bun:sqlite'
import { CONFIG } from '../config/index.js'
import { statements } from './statements.js'
import { runMigrations } from './migrations.js'
import { mkdir } from "node:fs/promises"

// 确保数据目录存在
await mkdir("data", { recursive: true })

// 初始化数据库连接
export const db = new Database(CONFIG.DB_PATH)

// SQLite性能与安全配置
db.run('PRAGMA journal_mode = WAL;')
db.run('PRAGMA synchronous = NORMAL;')
db.run('PRAGMA foreign_keys = ON;')
db.run('PRAGMA temp_store = MEMORY;')
db.run('PRAGMA cache_size = -20000;')
db.run('PRAGMA busy_timeout = 5000;')

// 执行数据库迁移（替代原有的 CREATE TABLE IF NOT EXISTS）
runMigrations(db)

// 预编译所有SQL语句
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

process.on('SIGTERM', () => {
  console.log('\n🛑 正在关闭数据库连接...')
  db.close()
  process.exit(0)
})
