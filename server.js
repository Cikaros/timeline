import Database from 'bun:sqlite'
import { toISODate, formatDateObj, normalizeDateString, iterateDateRange, parseInputToDates } from './shared/dateParser.js'

const DB_PATH = './data.sqlite'

const db = new Database(DB_PATH)

// Initialize tables
db.run(`
  CREATE TABLE IF NOT EXISTS meetings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    note TEXT
  );
`)

db.run(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`)

db.run(`
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    expires INTEGER
  );
`)

// Helpers
const ALLOWED_ORIGINS = [ 'http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000' ]

function getCorsHeaders(req){
  const origin = req.headers.get('origin') || ''
  let allow = ''
  if(ALLOWED_ORIGINS.includes(origin)) allow = origin
  else if(origin === '') allow = '*'
  else allow = origin // allow dev origin by echoing (safer to echo than *)

  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  }
}

// formatDateObj is provided by shared/dateParser

async function sha256Hex(text){
  const enc = new TextEncoder()
  const data = enc.encode(text)
  const hashBuf = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuf))
  return hashArray.map(b => b.toString(16).padStart(2,'0')).join('')
}

async function getPasswordHash(){
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('password_hash')
  if(row && row.value) return row.value
  // initialize with default password '5201314'
  const hv = await sha256Hex('5201314')
  db.prepare('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)').run('password_hash', hv)
  return hv
}

function createSession(token, expires){
  db.prepare('INSERT OR REPLACE INTO sessions (token,expires) VALUES (?,?)').run(token, expires)
}

function verifySession(token){
  if(!token) return false
  const row = db.prepare('SELECT expires FROM sessions WHERE token = ?').get(token)
  if(!row) return false
  if(Date.now() > Number(row.expires)){
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token)
    return false
  }
  return true
}

function parseCookies(cookieHeader){
  if(!cookieHeader) return {}
  return cookieHeader.split(';').map(s=>s.trim()).filter(Boolean).reduce((acc,c)=>{ const [k,v]=c.split('='); acc[k]=v; return acc }, {})
}

function requireAuth(req){
  const cookies = parseCookies(req.headers.get('cookie') || '')
  const token = cookies['session']
  return verifySession(token) ? token : null
}

// Date parsing utilities are provided by shared/dateParser.js (imported at top)

// Ensure default password exists
await getPasswordHash()

function jsonResponse(body, opts={status:200}, req=null){
  const headers = Object.assign({ 'Content-Type':'application/json' }, req ? getCorsHeaders(req) : {})
  return new Response(JSON.stringify(body), { status: opts.status, headers })
}

console.log('Starting Bun API server on http://localhost:3000')

export default Bun.serve({
  port: 3000,
  async fetch(req){
    const url = new URL(req.url)
    const path = url.pathname
    // Handle CORS preflight
    if(req.method === 'OPTIONS'){
      return new Response(null, { status:204, headers: getCorsHeaders(req) })
    }
    try{
      // login
      if(path === '/api/login' && req.method === 'POST'){
        const body = await req.json().catch(()=>({}))
        const password = body.password || ''
        const stored = await getPasswordHash()
        const hv = await sha256Hex(password)
        if(hv !== stored) return jsonResponse({ error: 'invalid password' }, { status:401 }, req)
        const token = crypto.randomUUID()
        const expires = Date.now() + 24*60*60*1000
        createSession(token, expires)
          // set HttpOnly cookie. Use SameSite=Lax for local dev when front-end proxies /api to backend.
          const cookie = `session=${token}; HttpOnly; Path=/; Max-Age=${24*60*60}; SameSite=Lax`
          return new Response(JSON.stringify({ ok:true }), { status:200, headers: Object.assign({ 'Content-Type':'application/json', 'Set-Cookie': cookie }, getCorsHeaders(req)) })
      }

      // change password (requires auth)
      if(path === '/api/password' && req.method === 'POST'){
        const tok = requireAuth(req)
        if(!tok) return jsonResponse({ error: 'unauthorized' }, { status:401 }, req)
        const body = await req.json().catch(()=>({}))
        const newPass = body.newPassword
        if(!newPass) return jsonResponse({ error: 'newPassword required' }, { status:400 }, req)
        const hv = await sha256Hex(newPass)
        db.prepare('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)').run('password_hash', hv)
        return jsonResponse({ ok:true }, { status:200 }, req)
      }

      // set first meeting date
      if(path === '/api/first-meeting' && req.method === 'POST'){
        const tok = requireAuth(req)
        if(!tok) return jsonResponse({ error: 'unauthorized' }, { status:401 }, req)
        const body = await req.json().catch(()=>({}))
        const date = normalizeDateString(body.date)
        if(!date) return jsonResponse({ error:'invalid date' }, { status:400 }, req)
        db.prepare('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)').run('first_meeting', date)
        return jsonResponse({ ok:true, date }, { status:200 }, req)
      }

      // list settings (protected)
      if(path === '/api/settings' && req.method === 'GET'){
        const tok = requireAuth(req)
        if(!tok) return jsonResponse({ error: 'unauthorized' }, { status:401 }, req)
        const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('first_meeting')
        return jsonResponse({ first_meeting: row ? row.value : null }, { status:200 }, req)
      }

      // list meetings
      if(path === '/api/meetings' && req.method === 'GET'){
        const tok = requireAuth(req)
        if(!tok) return jsonResponse({ error: 'unauthorized' }, { status:401 }, req)
        const limit = Number(url.searchParams.get('limit')) || 50
        const offset = Number(url.searchParams.get('offset')) || 0
        const totalRow = db.prepare('SELECT COUNT(*) as c FROM meetings').get()
        const rows = db.prepare('SELECT id, date, note FROM meetings ORDER BY date DESC, id DESC LIMIT ? OFFSET ?').all(limit, offset)
        return jsonResponse({ rows, total: totalRow ? totalRow.c : 0 }, { status:200 }, req)
      }

      // insert meetings (supports ranges and multiple separators)
      if(path === '/api/meetings' && req.method === 'POST'){
        const tok = requireAuth(req)
        if(!tok) return jsonResponse({ error: 'unauthorized' }, { status:401 })
        const body = await req.json().catch(()=>({}))
        const input = body.input || body.date || ''
        const note = body.note || ''
        const dates = parseInputToDates(input)
        if(dates.length === 0) return jsonResponse({ error:'no valid dates parsed' }, { status:400 }, req)
        const inserted = []
        const skipped = []
        const existsStmt = db.prepare('SELECT id FROM meetings WHERE date = ?')
        const ins = db.prepare('INSERT INTO meetings (date,note) VALUES (?,?)')
        for(const d of dates){
          const ex = existsStmt.get(d)
          if(ex){ skipped.push(d); continue }
          const r = ins.run(d, note)
          // run returns { changes, lastInsertROWID }
          const id = r && r.lastInsertROWID ? r.lastInsertROWID : null
          inserted.push({ id, date: d, note })
        }
        return jsonResponse({ inserted, skipped }, { status:200 }, req)
      }

      // bulk clear meetings
      if(path === '/api/meetings/clear' && req.method === 'POST'){
        const tok = requireAuth(req)
        if(!tok) return jsonResponse({ error: 'unauthorized' }, { status:401 }, req)
        db.prepare('DELETE FROM meetings').run()
        return jsonResponse({ ok:true }, { status:200 }, req)
      }

      // update meeting note
      if(path.startsWith('/api/meetings/') && req.method === 'POST'){
        const tok = requireAuth(req)
        if(!tok) return jsonResponse({ error: 'unauthorized' }, { status:401 }, req)
        const id = path.split('/').pop()
        const body = await req.json().catch(()=>({}))
        const note = body.note || ''
        db.prepare('UPDATE meetings SET note = ? WHERE id = ?').run(note, Number(id))
        return jsonResponse({ ok:true }, { status:200 }, req)
      }
      // delete meeting
      if(path.startsWith('/api/meetings/') && req.method === 'DELETE'){
        const tok = requireAuth(req)
        if(!tok) return jsonResponse({ error: 'unauthorized' }, { status:401 }, req)
        const id = path.split('/').pop()
        db.prepare('DELETE FROM meetings WHERE id = ?').run(Number(id))
        return new Response(null, { status:204, headers: getCorsHeaders(req) })
      }

      // logout
      if(path === '/api/logout' && req.method === 'POST'){
        // clear session from DB and expire cookie
        const cookies = parseCookies(req.headers.get('cookie') || '')
        const token = cookies['session']
        if(token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token)
          const cookie = `session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`
          return new Response(JSON.stringify({ ok:true }), { status:200, headers: Object.assign({ 'Content-Type':'application/json', 'Set-Cookie': cookie }, getCorsHeaders(req)) })
      }

      // fallback static file or not found
      if(req.method === 'GET' && (path === '/' || path.startsWith('/static') || path.endsWith('.html') || path.endsWith('.js') || path.endsWith('.css'))){
        // let Bun serve static files from disk and include CORS headers
        const filePath = './' + (path === '/' ? 'index.html' : path.slice(1))
        try{
          let t = await Bun.file(filePath).text()
          // Quick dev fallback: when serving source `src/main.js` (unbuilt),
          // Vite's ESM imports of CSS (import './styles.css') will cause browsers
          // to attempt to fetch the CSS as a JS module. To avoid MIME errors
          // in environments where the bundle isn't produced, replace that import
          // with a runtime stylesheet injection so the browser loads CSS as a stylesheet.
          if(path === '/src/main.js' || filePath.endsWith('/src/main.js')){
            t = t.replace(/import\s+['"]\.\/styles\.css['"];?\s*/g, `// injected: load stylesheet at runtime\n(function(){var l=document.createElement('link');l.rel='stylesheet';l.href='/src/styles.css';document.head.appendChild(l)})()\n`)
          }
          let contentType = 'text/html'
          if(path.endsWith('.css')) contentType = 'text/css'
          else if(path.endsWith('.js')) contentType = 'application/javascript'
          else if(path.endsWith('.html')) contentType = 'text/html'
          const headers = Object.assign({ 'Content-Type': contentType }, getCorsHeaders(req))
          return new Response(t, { headers })
        }catch(e){
          return new Response('Not found', { status:404, headers: getCorsHeaders(req) })
        }
      }

      return jsonResponse({ error: 'not found' }, { status:404 })
    }catch(err){
      console.error(err)
      return jsonResponse({ error: 'server error', detail: String(err) }, { status:500 })
    }
  }
})
