// Shared date parsing utilities used by server and client
export function toISODate(y, m, d) {
  const mm = String(m).padStart(2, '0')
  const dd = String(d).padStart(2, '0')
  return `${y}-${mm}-${dd}`
}

export function formatDateObj(d) {
  return toISODate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
}

function isValidCalendarDate(y, m, d) {
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

export function normalizeDateString(s) {
  if (!s) return null
  const value = String(s).trim()

  if (/^\d{8}$/.test(value)) {
    const y = Number(value.slice(0, 4))
    const m = Number(value.slice(4, 6))
    const d = Number(value.slice(6, 8))
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && isValidCalendarDate(y, m, d)) {
      return toISODate(y, m, d)
    }
  }

  const parts = value.split(/[\/\-.]/).map(p => p.trim()).filter(Boolean)
  if (parts.length === 3) {
    const y = Number(parts[0])
    const m = Number(parts[1])
    const d = Number(parts[2])
    if (Number.isInteger(y) && Number.isInteger(m) && Number.isInteger(d) && isValidCalendarDate(y, m, d)) {
      return toISODate(y, m, d)
    }
  }

  return null
}

const MAX_RANGE_DAYS = 366

export function iterateDateRange(startISO, endISO) {
  const [ys, ms, ds] = startISO.split('-').map(Number)
  const [ye, me, de] = endISO.split('-').map(Number)
  const start = Date.UTC(ys, ms - 1, ds)
  const end = Date.UTC(ye, me - 1, de)
  if (start > end) return []

  const oneDay = 24 * 60 * 60 * 1000
  const dayCount = Math.round((end - start) / oneDay) + 1
  if (dayCount > MAX_RANGE_DAYS) return []

  const result = []
  for (let t = start; t <= end; t += oneDay) {
    result.push(formatDateObj(new Date(t)))
  }
  return result
}

const MAX_TOTAL_DATES = 366

export function parseInputToDates(input) {
  if (!input) return []
  let value = String(input)

  // Compact hyphen ranges are unambiguous and safe to normalize.
  value = value.replace(/\b(\d{8})-(\d{8})\b/g, '$1~$2')
  value = value.replace(/[~〜–—]/g, '~')

  const parts = value.split(/[,;；、\n]+/).map(p => p.trim()).filter(Boolean)
  const dates = []
  for (const part of parts) {
    const subparts = part.split(/\s+/).map(p => p.trim()).filter(Boolean)
    for (const token of subparts) {
      if (dates.length >= MAX_TOTAL_DATES) break
      if (token.includes('~')) {
        const [a, b] = token.split('~').map(x => x.trim()).filter(Boolean)
        const startDate = normalizeDateString(a)
        const endDate = normalizeDateString(b)
        if (startDate && endDate) {
          const list = iterateDateRange(startDate, endDate)
          for (const date of list) {
            if (dates.length >= MAX_TOTAL_DATES) break
            dates.push(date)
          }
        }
      } else {
        const date = normalizeDateString(token)
        if (date) dates.push(date)
      }
    }
    if (dates.length >= MAX_TOTAL_DATES) break
  }

  const seen = new Set()
  const result = []
  for (const date of dates) {
    if (!seen.has(date)) {
      seen.add(date)
      result.push(date)
    }
  }
  return result
}
