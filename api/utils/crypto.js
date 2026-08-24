/**
 * 密码哈希与验证（使用 bcrypt）
 * 兼容旧版 SHA-256 哈希，验证成功后自动升级
 */

/**
 * 哈希新密码
 * @param {string} password 明文密码
 * @returns {Promise<string>} bcrypt 哈希值
 */
export async function hashPassword(password) {
  return Bun.password.hash(password, {
    algorithm: 'bcrypt',
    cost: 12,
  })
}

/**
 * 验证密码（兼容旧版 SHA-256 哈希）
 * @param {string} password 明文密码
 * @param {string} storedHash 存储的哈希值
 * @returns {Promise<{valid: boolean, needsRehash: boolean}>}
 */
export async function verifyPassword(password, storedHash) {
  if (!storedHash) return { valid: false, needsRehash: false }

  // 旧格式：salt:hash（SHA-256）
  if (storedHash.includes(':') && !storedHash.startsWith('$')) {
    const valid = await verifySHA256(password, storedHash)
    return { valid, needsRehash: valid }
  }

  // 新格式：bcrypt
  const valid = await Bun.password.verify(password, storedHash)
  return { valid, needsRehash: false }
}

/**
 * 旧版 SHA-256 验证（用于向后兼容）
 */
async function verifySHA256(password, storedHash) {
  const [salt, hash] = storedHash.split(':')
  const encoder = new TextEncoder()
  const data = encoder.encode(password + salt)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const inputHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  // 旧格式用普通比较（迁移后不再使用）
  return inputHash === hash
}
