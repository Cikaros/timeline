import { db, preparedStatements } from '../db/index.js'
import { parseInputToDates } from '../utils/dateParser.js'
import { isMeetingCategory } from './categories.service.js'

/**
 * 获取会议列表
 */
export function getMeetings(limit = 1000, offset = 0, category = '') {
  if (category && !isMeetingCategory(category)) return { rows: [], total: 0 }

  const total = category
    ? preparedStatements.getMeetingCountByCategory.get(category).count
    : preparedStatements.getMeetingCount.get().count
  const rows = category
    ? preparedStatements.getMeetingsByCategory.all(category, limit, offset)
    : preparedStatements.getMeetings.all(limit, offset)
  return { rows, total }
}

/**
 * 批量插入会议
 */
export function insertMeetings(input, note = '', category = 'meetings') {
  const dates = parseInputToDates(input)
  if (dates.length === 0) return { inserted: [], skipped: [] }
  if (!isMeetingCategory(category)) throw new Error('请选择有效分类')

  const inserted = []
  const skipped = []

  const transaction = db.transaction(() => {
    for (const date of dates) {
      if (preparedStatements.getMeetingByDate.get(date, category)) {
        skipped.push(date)
        continue
      }
      const result = preparedStatements.insertMeeting.run(date, note, null, Date.now(), category)
      inserted.push({
        id: result.lastInsertRowid,
        date,
        note,
        category
      })
    }
  })

  transaction()
  return { inserted, skipped }
}

/**
 * 更新会议备注
 * @returns {number} 受影响的行数
 */
export function updateMeetingNote(id, note, category = 'meetings') {
  if (!isMeetingCategory(category)) throw new Error('请选择有效分类')
  const result = preparedStatements.updateMeetingNote.run(note, category, Date.now(), id)
  return result.changes
}

/**
 * 删除会议
 * @returns {number} 受影响的行数
 */
export function deleteMeeting(id) {
  const result = preparedStatements.deleteMeeting.run(id)
  return result.changes
}
