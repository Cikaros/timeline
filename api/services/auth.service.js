import { CONFIG } from '../config/index.js'
import { preparedStatements } from '../db/index.js'
import {
  hashPassword,
  hashSessionToken,
  verifyPassword
} from '../utils/crypto.js'

async function verifyAndUpgradeHash(password, storedHash) {
  const { valid, needsRehash } = await verifyPassword(password, storedHash)
  if (needsRehash && valid) {
    const newHash = await hashPassword(password)
    preparedStatements.setSetting.run('password_hash', newHash, Date.now())
  }
  return valid
}

function getSettingValue(key) {
  return preparedStatements.getSetting.get(key)?.value
}

function setSettingValue(key, value) {
  preparedStatements.setSetting.run(key, value, Date.now())
}

export async function initializeDefaultPassword() {
  if (!CONFIG.DEFAULT_PASSWORD) {
    throw new Error('DEFAULT_PASSWORD 未设置')
  }

  const row = preparedStatements.getSetting.get('password_hash')
  if (!row) {
    const hashedPassword = await hashPassword(CONFIG.DEFAULT_PASSWORD)
    preparedStatements.setSetting.run('password_hash', hashedPassword, Date.now())
    setSettingValue('password_is_default', '1')
    return
  }

  // Existing databases did not originally record this flag. Infer it once.
  if (preparedStatements.getSetting.get('password_is_default') === undefined) {
    const { valid } = await verifyPassword(CONFIG.DEFAULT_PASSWORD, row.value)
    setSettingValue('password_is_default', valid ? '1' : '0')
  }
}

export async function login(password) {
  const storedHash = getSettingValue('password_hash')
  if (!storedHash) return null

  if (!await verifyAndUpgradeHash(password, storedHash)) return null

  let mustChangePassword = getSettingValue('password_is_default') === '1'
  if (mustChangePassword && CONFIG.DEFAULT_PASSWORD) {
    const { valid: stillUsesDefaultPassword } = await verifyPassword(
      CONFIG.DEFAULT_PASSWORD,
      storedHash
    )
    if (!stillUsesDefaultPassword) {
      setSettingValue('password_is_default', '0')
      mustChangePassword = false
    }
  }

  const token = crypto.randomUUID()
  const tokenHash = hashSessionToken(token)
  const expires = Date.now() + CONFIG.SESSION_DURATION
  preparedStatements.createSession.run(tokenHash, expires)

  return { token, expires, mustChangePassword }
}

export async function verifyCurrentPassword(password) {
  const storedHash = getSettingValue('password_hash')
  if (!storedHash) return false
  return verifyAndUpgradeHash(password, storedHash)
}

export function logout(token) {
  if (token) {
    preparedStatements.deleteSession.run(hashSessionToken(token))
  }
}

export async function changePassword(newPassword, currentToken) {
  const hashedPassword = await hashPassword(newPassword)
  preparedStatements.setSetting.run('password_hash', hashedPassword, Date.now())
  setSettingValue('password_is_default', '0')

  const currentTokenHash = currentToken ? hashSessionToken(currentToken) : null
  if (currentTokenHash) {
    preparedStatements.deleteAllSessionsExcept.run(currentTokenHash)
    preparedStatements.deleteSession.run(currentTokenHash)
  } else {
    preparedStatements.deleteAllSessions.run()
  }

  const token = crypto.randomUUID()
  const tokenHash = hashSessionToken(token)
  const expires = Date.now() + CONFIG.SESSION_DURATION
  preparedStatements.createSession.run(tokenHash, expires)

  return { token, expires }
}
