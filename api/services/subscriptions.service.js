import { db, preparedStatements } from '../db/index.js'

const MAX_SUBSCRIPTIONS = 20

function normalizeSubscription(row) {
  return {
    ...row,
    enabled: Boolean(row.enabled)
  }
}

/**
 * 获取全部订阅链接
 */
export function getSubscriptions(dependencies = {}) {
  const { prepared, userId } = dependencies
  const statements = prepared || preparedStatements
  const rows = userId
    ? statements.getCalendarSubscriptionsByUser.all(userId)
    : statements.getCalendarSubscriptions.all()
  return rows.map(normalizeSubscription)
}

/**
 * 创建订阅链接
 */
export function createSubscription(name = '手机日历', userId = null, dependencies = {}) {
  const { prepared } = dependencies
  const statements = prepared || preparedStatements

  if (statements.getCalendarSubscriptionCount.get().count >= MAX_SUBSCRIPTIONS) {
    throw new Error('最多只能创建20个订阅链接')
  }

  const now = Date.now()
    const result = statements.insertCalendarSubscription.run(
      name,
      crypto.randomUUID(),
      1,
      userId,
      now,
      now
    )
  const row = statements.getCalendarSubscriptionById.get(result.lastInsertRowid)
  return normalizeSubscription(row)
}

/**
 * 更新订阅链接
 */
export function updateSubscription(id, updates, dependencies = {}) {
  const { prepared } = dependencies
  const statements = prepared || preparedStatements
  const row = statements.getCalendarSubscriptionById.get(id)
  if (!row) return null

  const name = updates.name ?? row.name
  const enabled = updates.enabled === undefined ? row.enabled : Number(updates.enabled)
  statements.updateCalendarSubscription.run(name, enabled, Date.now(), id)
  return normalizeSubscription(statements.getCalendarSubscriptionById.get(id))
}

/**
 * 删除订阅链接
 */
export function deleteSubscription(id, dependencies = {}) {
  const { prepared } = dependencies
  const statements = prepared || preparedStatements
  return statements.deleteCalendarSubscription.run(id).changes > 0
}

/**
 * 记录订阅访问统计
 */
export function touchSubscription(id, dependencies = {}) {
  const { prepared } = dependencies
  const statements = prepared || preparedStatements
  statements.touchCalendarSubscription.run(Date.now(), id)
}
