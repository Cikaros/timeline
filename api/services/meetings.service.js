import { db, preparedStatements } from '../db/index.js'
import { parseInputToDates } from '../utils/dateParser.js'

/**
 * 获取会议列表
 */
export function getMeetings(limit = 1000, offset = 0) {
  const total = preparedStatements.getMeetingCount.get().count
  const rows = preparedStatements.getMeetings.all(limit, offset)
  return { rows, total }
}

/**
 * 批量插入会议
 */
export function insertMeetings(input, note = '') {
  const dates = parseInputToDates(input)
  if (dates.length === 0) return { inserted: [], skipped: [] }

  const inserted = []
  const skipped = []

  const transaction = db.transaction(() => {
    for (const date of dates) {
      if (preparedStatements.getMeetingByDate.get(date)) {
        skipped.push(date)
        continue
      }
      const result = preparedStatements.insertMeeting.run(date, note)
      inserted.push({
        id: result.lastInsertRowid,
        date,
        note
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
export function updateMeetingNote(id, note) {
  const result = preparedStatements.updateMeetingNote.run(note, id)
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
