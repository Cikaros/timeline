import { randomBytes } from 'node:crypto'

/**
 * 带盐值的SHA256密码哈希
 * @param {string} password 明文密码
 * @param {string|null} salt 可选盐值，不传则生成随机盐
 * @returns {string} 格式：salt:hash
 */
export async function hashPassword(password, salt = null) {
  salt = salt || randomBytes(16).toString('hex')
  const encoder = new TextEncoder()
  const data = encoder.encode(password + salt)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return `${salt}:${hashHex}`
}

/**
 * 验证密码
 * @param {string} password 明文密码
 * @param {string} storedHash 存储的哈希值（salt:hash）
 * @returns {boolean} 验证结果
 */
export async function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false
  const [salt, hash] = storedHash.split(':')
  const inputHash = await hashPassword(password, salt)
  return inputHash === storedHash
}