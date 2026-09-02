import { preparedStatements } from '../db/index.js'
import { normalizeDateString } from '../utils/dateParser.js'

/**
 * 获取所有设置
 * @returns {object} 设置对象
 */
export function getSettings() {
  const firstMeeting = preparedStatements.getSetting.get('first_meeting')?.value
  const usesDefaultPassword = preparedStatements.getSetting.get('password_is_default')?.value === '1'
  return {
    first_meeting: firstMeeting || null,
    must_change_password: usesDefaultPassword
  }
}

/**
 * 设置初次见面日期
 * @param {string} dateStr 日期字符串
 * @returns {string|null} 标准化后的日期，失败返回null
 */
export function setFirstMeeting(dateStr) {
  const date = normalizeDateString(dateStr)
  if (!date) return null

  preparedStatements.setSetting.run('first_meeting', date, Date.now())
  return date
}