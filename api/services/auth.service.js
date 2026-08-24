import { CONFIG } from '../config/index.js'
import { preparedStatements } from '../db/index.js'
import { hashPassword, verifyPassword } from '../utils/crypto.js'

/**
 * 验证密码并在需要时自动升级哈希
 * @param {string} password 明文密码
 * @param {string} storedHash 存储的哈希
 * @returns {boolean} 密码是否正确
 */
async function verifyAndUpgradeHash(password, storedHash) {
  const { valid, needsRehash } = await verifyPassword(password, storedHash)
  if (needsRehash && valid) {
    const newHash = await hashPassword(password)
    preparedStatements.setSetting.run('password_hash', newHash, Date.now())
  }
  return valid
}

/**
 * 初始化默认密码
 */
export async function initializeDefaultPassword() {
  const row = preparedStatements.getSetting.get('password_hash')
  if (row) return

  const hashedPassword = await hashPassword(CONFIG.DEFAULT_PASSWORD)
  preparedStatements.setSetting.run('password_hash', hashedPassword, Date.now())
  console.log('✅ 已初始化默认密码，请尽快修改')
}

/**
 * 登录验证
 * @param {string} password 明文密码
 * @returns {object|null} 登录成功返回{token, expires}，否则返回null
 */
export async function login(password) {
  const storedHash = preparedStatements.getSetting.get('password_hash')?.value
  if (!storedHash) return null

  if (!await verifyAndUpgradeHash(password, storedHash)) return null

  const token = crypto.randomUUID()
  const expires = Date.now() + CONFIG.SESSION_DURATION
  preparedStatements.createSession.run(token, expires)

  return { token, expires }
}

/**
 * 验证当前密码（用于修改密码前确认）
 * @param {string} password 明文密码
 * @returns {boolean}
 */
export async function verifyCurrentPassword(password) {
  const storedHash = preparedStatements.getSetting.get('password_hash')?.value
  if (!storedHash) return false

  return verifyAndUpgradeHash(password, storedHash)
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
 * @param {string|null} currentToken 当前会话令牌（保留此会话）
 * @returns {object|null} 新会话信息 {token, expires}，或 null
 */
export async function changePassword(newPassword, currentToken) {
  const hashedPassword = await hashPassword(newPassword)
  preparedStatements.setSetting.run('password_hash', hashedPassword, Date.now())

  // 删除除当前会话外的所有会话
  preparedStatements.deleteAllSessionsExcept.run(currentToken)

  // 为当前用户签发新会话（旧 token 失效）
  if (currentToken) {
    preparedStatements.deleteSession.run(currentToken)
  }
  const token = crypto.randomUUID()
  const expires = Date.now() + CONFIG.SESSION_DURATION
  preparedStatements.createSession.run(token, expires)

  return { token, expires }
}
