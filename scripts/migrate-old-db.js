/**
 * 旧版数据库一次性迁移脚本
 *
 * 用法（仓库根目录执行）：
 *   DEFAULT_PASSWORD=<初始密码> bun run scripts/migrate-old-db.js
 *   bun run scripts/migrate-old-db.js --password <旧密码>  # 校验 MD5 后保留旧密码
 *
 * 迁移内容：meetings（全部）、first_meeting 设置、password_hash
 * 不迁移：sessions（旧会话均已过期，登录后重新签发）
 * 可重复执行：已存在的日期自动跳过
 */
import Database from 'bun:sqlite'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { hashPassword } from '../api/utils/crypto.js'

const ROOT = join(import.meta.dirname, '..')
const OLD_DB = join(ROOT, 'data', 'data.sqlite')
const NEW_DB = join(ROOT, 'data', 'timeline.db')
const DEFAULT_PASSWORD = process.env.DEFAULT_PASSWORD

// 解析 --password 参数
let oldPassword = null
const idx = process.argv.indexOf('--password')
if (idx !== -1) oldPassword = process.argv[idx + 1]

if (!existsSync(OLD_DB)) {
  console.error('❌ 找不到旧数据库：', OLD_DB)
  process.exit(1)
}

const oldDb = new Database(OLD_DB, { readonly: true })
const newDb = new Database(NEW_DB)

// 1. 一致性备份新库（VACUUM INTO 可正确处理 WAL 状态）
const dateTag = new Date().toISOString().slice(0, 10).replace(/-/g, '')
const backupPath = `${NEW_DB}.bak-${dateTag}`
newDb.run('VACUUM INTO ?', [backupPath])
console.log(`✅ 已备份：${backupPath}`)

// 2. 读取旧库数据
const meetings = oldDb.query('SELECT date, note FROM meetings').all()
const firstMeeting = oldDb.query("SELECT value FROM settings WHERE key = 'first_meeting'").get()?.value
const storedHash = oldDb.query("SELECT value FROM settings WHERE key = 'password_hash'").get()?.value
oldDb.close()
console.log(`📦 旧库数据：meetings ${meetings.length} 条，first_meeting=${firstMeeting || '无'}`)

// 3. 确定要写入的 password_hash
let passwordHash
if (storedHash && storedHash.startsWith('$2')) {
  // bcrypt 哈希，直接复制
  passwordHash = storedHash
} else if (storedHash && storedHash.includes(':')) {
  // 旧版 salt:hash（SHA-256），当前代码兼容，首次登录自动升级
  passwordHash = storedHash
} else {
  // 32 位 hex（MD5）：当前代码不兼容，需要重新哈希
  if (oldPassword) {
    const md5 = createHash('md5').update(oldPassword).digest('hex')
    if (md5 !== storedHash) {
      console.error('❌ 提供的旧密码 MD5 校验不一致，请确认密码')
      process.exit(1)
    }
    passwordHash = await hashPassword(oldPassword)
    console.log('🔑 已用旧密码重新生成 bcrypt 哈希')
  } else {
    if (!DEFAULT_PASSWORD) {
      console.error('❌ 旧密码为 MD5 格式且未提供 --password 时，必须设置 DEFAULT_PASSWORD')
      process.exit(1)
    }
    passwordHash = await hashPassword(DEFAULT_PASSWORD)
    console.log('🔑 旧密码为 MD5 格式且未提供旧密码，已使用 DEFAULT_PASSWORD 重置')
  }
}

// 4. 事务内写入新库（跳过已存在的日期，保证可重复执行）
const now = Date.now()
const insertMeeting = newDb.prepare('INSERT INTO meetings (date, note, created_at) VALUES (?, ?, ?)')
const setSetting = newDb.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)')
const existsDate = newDb.prepare('SELECT 1 FROM meetings WHERE date = ?')

let inserted = 0
let skipped = 0
newDb.transaction(() => {
  for (const row of meetings) {
    if (existsDate.get(row.date)) {
      skipped++
      continue
    }
    insertMeeting.run(row.date, row.note, now)
    inserted++
  }
  setSetting.run('first_meeting', firstMeeting, now)
  setSetting.run('password_hash', passwordHash, now)
})()

// 5. 验证
const count = newDb.query('SELECT COUNT(*) as c FROM meetings').get().c
const settings = newDb.query('SELECT key, value FROM settings').all()
console.log(`✅ 迁移完成：新增 ${inserted} 条，跳过 ${skipped} 条（已存在），meetings 总数 ${count}`)
console.log('📋 设置：', settings.map(s => `${s.key}=${s.value.slice(0, 12)}...`).join('，'))
console.log('\n下一步：')
console.log('  1. 启动 bun run api 并用密码登录验证')
console.log(`  2. 确认无误后将旧库归档：mv data/data.sqlite data/data.sqlite.migrated-${dateTag}`)

newDb.close()
