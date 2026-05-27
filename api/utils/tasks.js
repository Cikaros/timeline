import { CONFIG } from '../config/index.js'
import { preparedStatements } from '../db/index.js'

/**
 * 清理过期会话
 */
export function cleanupExpiredSessions() {
  const result = preparedStatements.cleanupExpiredSessions.run(Date.now())
  if (result.changes > 0) {
    console.log(`🧹 已清理 ${result.changes} 个过期会话`)
  }
}

/**
 * 启动所有定时任务
 */
export function startScheduledTasks() {
  setInterval(cleanupExpiredSessions, CONFIG.SESSION_CLEANUP_INTERVAL)
  console.log('✅ 定时任务已启动')
}