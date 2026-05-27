import { db, preparedStatements } from '../db/index.js'
import { parseInputToDates } from '../utils/dateParser.js'

/**
 * 获取会议列表
 * @param {number} limit 数量限制
 * @param {number} offset 偏移量
 * @returns {object} {rows: 会议列表, total: 总数}
 */
export function getMeetings(limit = 1000, offset = 0) {
  const total = preparedStatements.getMeetingCount.get().count
  const rows = preparedStatements.getMeetings.all(limit, offset)
  return { rows, total }
}

/**
 * 批量插入会议
 * @param {string} input 日期输入
 * @param {string} note 备注
 * @returns {object} {inserted: 已插入列表, skipped: 已跳过列表}
 */
export function insertMeetings(input, note = '') {
  const dates = parseInputToDates(input)
  if (dates.length === 0) return { inserted: [], skipped: [] }

  const inserted = []
  const skipped = []

  // 使用事务保证原子性
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
 * @param {number} id 会议ID
 * @param {string} note 新备注
 */
export function updateMeetingNote(id, note) {
  preparedStatements.updateMeetingNote.run(note, id)
}

/**
 * 删除会议
 * @param {number} id 会议ID
 */
export function deleteMeeting(id) {
  preparedStatements.deleteMeeting.run(id)
}

/**
 * 清空所有会议
 */
export function clearAllMeetings() {
  preparedStatements.clearAllMeetings.run()
}