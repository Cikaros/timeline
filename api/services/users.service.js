import { db, preparedStatements } from '../db/index.js'
import { CONFIG } from '../config/index.js'
import {
  hashPassword,
  hashSessionToken,
  verifyPassword
} from '../utils/crypto.js'

const MAX_ACCOUNTS = 2

function normalizeUser(row) {
  if (!row) return null
  const { password_hash, ...user } = row
  return user
}

async function getDefaultPasswordHash(dependencies = {}) {
  const { prepared } = dependencies
  const statements = prepared || preparedStatements
  const existing = statements.getSetting.get('password_hash')?.value
  if (existing) return existing

  const hashedPassword = await hashPassword(CONFIG.DEFAULT_PASSWORD)
  statements.setSetting.run('password_hash', hashedPassword, Date.now())
  statements.setSetting.run('password_is_default', '1', Date.now())
  return hashedPassword
}

/**
 * 为旧数据创建 owner 账号，并迁移历史归属关系。
 */
export async function initializeDefaultAccount(dependencies = {}) {
  const { db: database = db, prepared } = dependencies
  const statements = prepared || preparedStatements
  const users = statements.getUsers.all()

  if (users.length === 0) {
    const passwordHash = await getDefaultPasswordHash(dependencies)
    const now = Date.now()
    const result = statements.insertUser.run('owner', passwordHash, now, now)
    const ownerId = result.lastInsertRowid
    statements.updateUserRole.run('admin', now, ownerId)
    statements.assignUnownedSessions.run(ownerId)
    statements.assignUnownedCalendarSubscriptions.run(ownerId)
    return normalizeUser(statements.getUserById.get(ownerId))
  }

  statements.assignUnownedSessions.run(users[0].id)
  statements.assignUnownedCalendarSubscriptions.run(users[0].id)
  return normalizeUser(users[0])
}

/**
 * 用户名 + 密码登录
 */
export async function login(username, password, dependencies = {}) {
  const { prepared } = dependencies
  const statements = prepared || preparedStatements
  const user = statements.getUserByUsername.get(username)
  if (!user) return null

  const { valid, needsRehash } = await verifyPassword(password, user.password_hash)
  if (!valid) return null

  if (needsRehash) {
    const hashedPassword = await hashPassword(password)
    statements.updateUserPassword.run(hashedPassword, Date.now(), user.id)
  }

  let mustChangePassword = false
  if (statements.getSetting.get('password_is_default')?.value === '1') {
    const { valid: stillUsesDefaultPassword } = await verifyPassword(
      CONFIG.DEFAULT_PASSWORD,
      user.password_hash
    )
    if (!stillUsesDefaultPassword) {
      statements.setSetting.run('password_is_default', '0', Date.now())
    } else {
      mustChangePassword = true
    }
  }

  const token = crypto.randomUUID()
  const tokenHash = hashSessionToken(token)
  const expires = Date.now() + CONFIG.SESSION_DURATION
  statements.createSession.run(tokenHash, expires, user.id)

  return {
    token,
    expires,
    mustChangePassword,
    user: normalizeUser(statements.getUserById.get(user.id))
  }
}

export function getAccounts(dependencies = {}) {
  const { prepared } = dependencies
  return (prepared || preparedStatements).getUsers.all()
}

export function getAccountById(id, dependencies = {}) {
  const { prepared } = dependencies
  return normalizeUser((prepared || preparedStatements).getUserById.get(id))
}

export async function createAccount(username, password, dependencies = {}) {
  const { prepared } = dependencies
  const statements = prepared || preparedStatements
  if (statements.getUserCount.get().count >= MAX_ACCOUNTS) {
    throw new Error('全局最多只能创建2个账号')
  }
  if (statements.getUserByUsername.get(username)) {
    throw new Error('用户名已存在')
  }

  const hashedPassword = await hashPassword(password)
  const now = Date.now()
  const result = statements.insertUser.run(username, hashedPassword, now, now)
  return normalizeUser(statements.getUserById.get(result.lastInsertRowid))
}

export function deleteAccount(id, dependencies = {}) {
  const { db: database = db, prepared } = dependencies
  const statements = prepared || preparedStatements
  const targetUser = statements.getUserById.get(id)
  if (targetUser?.role === 'admin') {
    throw new Error('管理员账号不允许删除')
  }

  if (statements.getUserCount.get().count <= 1) {
    throw new Error('至少需要保留一个账号')
  }

  const user = targetUser
  if (!user) return false
  if (user.role === 'admin') {
    throw new Error('管理员账号不允许删除')
  }

  const remove = database.transaction(() => {
    if (user.username === 'owner') {
      statements.setSetting.run('password_is_default', '0', Date.now())
    }
    statements.deleteCalendarSubscriptionsByUser.run(id)
    statements.deleteSessionsByUser.run(id)
    statements.deleteUser.run(id)
  })
  remove()
  return true
}

/**
 * 删除当前 session
 */
export function logout(token, dependencies = {}) {
  const { prepared } = dependencies
  const statements = prepared || preparedStatements
  if (!token) return
  statements.deleteSession.run(hashSessionToken(token))
}

/**
 * 校验当前密码并轮换当前用户的 session
 */
export async function changeCurrentUserPassword(
  userId,
  currentPassword,
  newPassword,
  currentToken,
  dependencies = {}
) {
  const { db: database = db, prepared } = dependencies
  const statements = prepared || preparedStatements
  const user = statements.getUserById.get(userId)
  if (!user) return null

  const { valid } = await verifyPassword(currentPassword, user.password_hash)
  if (!valid) return null

  const hashedPassword = await hashPassword(newPassword)
  statements.updateUserPassword.run(hashedPassword, Date.now(), userId)
  if (user.username === 'owner') {
    statements.setSetting.run('password_is_default', '0', Date.now())
  }

  const token = crypto.randomUUID()
  const tokenHash = hashSessionToken(token)
  const expires = Date.now() + CONFIG.SESSION_DURATION
  const rotate = database.transaction(() => {
    if (currentToken) {
      statements.deleteSessionsByUserExcept.run(
        userId,
        hashSessionToken(currentToken)
      )
    } else {
      statements.deleteSessionsByUser.run(userId)
    }
    statements.createSession.run(tokenHash, expires, userId)
  })
  rotate()

  return {
    token,
    expires,
    user: normalizeUser(statements.getUserById.get(userId))
  }
}
