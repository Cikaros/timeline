import { CONFIG } from '../config/index.js'
import { preparedStatements } from '../db/index.js'
import { hashPassword, verifyPassword } from '../utils/crypto.js'

/**
 * 初始化默认密码
 */
export async function initializeDefaultPassword() {
  const row = preparedStatements.getSetting.get('password_hash')
  if (row) return

  const hashedPassword = await hashPassword(CONFIG.DEFAULT_PASSWORD)
  preparedStatements.setSetting.run('password_hash', hashedPassword, Date.now())
  console.log('✅ 已初始化默认密码：', CONFIG.DEFAULT_PASSWORD)
}

/**
 * 登录验证
 * @param {string} password 明文密码
 * @returns {object|null} 登录成功返回{token, expires}，否则返回null
 */
export async function login(password) {
  const storedHash = preparedStatements.getSetting.get('password_hash')?.value
  if (!storedHash || !await verifyPassword(password, storedHash)) {
    return null
  }

  const token = crypto.randomUUID()
  const expires = Date.now() + CONFIG.SESSION_DURATION
  preparedStatements.createSession.run(token, expires)

  return { token, expires }
}

/**
 * 登出
 * @param {string} token 会话令牌
 */
export function logout(token) {
  if (token) {
    preparedStatements.deleteSession.run(token)
  }
}

/**
 * 修改密码
 * @param {string} newPassword 新密码
 */
export async function changePassword(newPassword) {
  const hashedPassword = await hashPassword(newPassword)
  preparedStatements.setSetting.run('password_hash', hashedPassword, Date.now())
  // 修改密码后使所有会话失效
  preparedStatements.deleteAllSessions.run()
}