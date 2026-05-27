// Shared date parsing utilities used by server and client
export function toISODate(y,m,d){
  const mm = String(m).padStart(2,'0')
  const dd = String(d).padStart(2,'0')
  return `${y}-${mm}-${dd}`
}

export function formatDateObj(d){
  return toISODate(d.getUTCFullYear(), d.getUTCMonth()+1, d.getUTCDate())
}

export function normalizeDateString(s){
  if(!s) return null
  s = String(s).trim()
  // attempt digits-only like 20250101
  const digits = s.replace(/[^0-9]/g, '')
  if(digits.length === 8){
    const y = Number(digits.slice(0,4))
    const m = Number(digits.slice(4,6))
    const d = Number(digits.slice(6,8))
    if(m>=1 && m<=12 && d>=1 && d<=31) return toISODate(y,m,d)
  }
  // try common formats
  const parts = s.split(/[\/\-\.]/).map(p=>p.trim()).filter(Boolean)
  if(parts.length === 3){
    const y = Number(parts[0])
    const m = Number(parts[1])
    const d = Number(parts[2])
    if(!Number.isNaN(y) && !Number.isNaN(m) && !Number.isNaN(d)) return toISODate(y,m,d)
  }
  // fallback: try Date parse
  const dt = new Date(s)
  if(!isNaN(dt.getTime())){
    return formatDateObj(new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate())))
  }
  return null
}

export function iterateDateRange(startISO, endISO){
  const [ys,ms,ds] = startISO.split('-').map(Number)
  const [ye,me,de] = endISO.split('-').map(Number)
  const start = Date.UTC(ys, ms-1, ds)
  const end = Date.UTC(ye, me-1, de)
  if(start > end) return []
  const res = []
  const oneDay = 24*60*60*1000
  for(let t = start; t <= end; t += oneDay){
    res.push(formatDateObj(new Date(t)))
  }
  return res
}

export function parseInputToDates(input){
  if(!input) return []
  input = String(input)
  // normalize range markers and separators (do NOT replace ASCII hyphen to avoid breaking YYYY-MM-DD)
  input = input.replace(/[~〜–—]/g, '~')
  const parts = input.split(/[,;；、\n]+/).map(p=>p.trim()).filter(Boolean)
  const dates = []
  for(const part of parts){
    const subparts = part.split(/\s+/).map(p=>p.trim()).filter(Boolean)
    for(const token of subparts){
      if(token.includes('~')){
        const [a,b] = token.split('~').map(x=>x.trim()).filter(Boolean)
        const da = normalizeDateString(a)
        const db = normalizeDateString(b)
        if(da && db){
          const list = iterateDateRange(da, db)
          dates.push(...list)
        }
      } else {
        const d = normalizeDateString(token)
        if(d) dates.push(d)
      }
    }
  }
  const seen = new Set()
  const out = []
  for(const d of dates){ if(!seen.has(d)){ seen.add(d); out.push(d) } }
  return out
}
