import { parseInputToDates } from '../shared/dateParser.js'

const STORAGE_KEY = 'timeline.meetings'

// Resolve API root: when developing with Vite (different port), point to Bun backend on :3000
const API_ROOT = (typeof location !== 'undefined' && location.port && Number(location.port) !== 3000)
  ? `${location.protocol}//${location.hostname}:3000`
  : ''

async function apiFetch(path, opts = {}){
  const headers = Object.assign({'Content-Type':'application/json'}, opts.headers || {})
  const options = Object.assign({}, opts, { headers, credentials: 'include' })
  const res = await fetch(path, options)
  if(res.status === 401){
    throw new Error('unauthorized')
  }
  
  return res
}

async function loadMeetings(){
  const res = await apiFetch(API_ROOT + '/api/meetings')
  return res.json()
}

// Toast utility (non-blocking notifications)
function showToast(message, type = 'info'){
  let container = document.getElementById('toast-container')
  if(!container){
    container = document.createElement('div')
    container.id = 'toast-container'
    container.style.position = 'fixed'
    container.style.right = '20px'
    container.style.top = '20px'
    container.style.zIndex = '9999'
    document.body.appendChild(container)
  }
  const t = document.createElement('div')
  t.className = 'toast ' + type
  t.textContent = message
  t.style.marginTop = '8px'
  t.style.padding = '10px 14px'
  t.style.borderRadius = '8px'
  t.style.background = type === 'error' ? 'rgba(255,90,90,0.95)' : 'rgba(0,0,0,0.7)'
  t.style.color = 'white'
  t.style.boxShadow = '0 6px 18px rgba(0,0,0,0.12)'
  t.style.opacity = '0'
  t.style.transition = 'opacity 220ms ease, transform 220ms ease'
  container.appendChild(t)
  requestAnimationFrame(()=>{ t.style.opacity = '1'; t.style.transform = 'translateY(0)' })
  setTimeout(()=>{
    t.style.opacity = '0'
    setTimeout(()=> t.remove(), 300)
  }, 3200)
}

async function insertMeetings(input, note){
  const res = await apiFetch(API_ROOT + '/api/meetings', { method: 'POST', body: JSON.stringify({ input, note }) })
  return res.json()
}

async function deleteMeeting(id){
  return apiFetch(API_ROOT + `/api/meetings/${id}`, { method: 'DELETE' })
}

function fmt(d){
  try{
    const s = (typeof d === 'string') ? d.split('T')[0] : d
    const [y,mo,da] = (s||'').split('-').map(Number)
    if(!y) return d
    return new Date(y, (mo||1)-1, da||1).toLocaleDateString()
  }catch(e){ return d }
}

function dateToISO(d){
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth()+1).padStart(2,'0')
  const da = String(d.getUTCDate()).padStart(2,'0')
  return `${y}-${m}-${da}`
}

function daysBetween(a,b){
  function toUTCDate(x){
    if(typeof x === 'string'){
      const s = x.split('T')[0]
      const [y,mo,da] = (s||'').split('-').map(Number)
      return Date.UTC(y, (mo||1)-1, da||1)
    }
    return Date.UTC(x.getFullYear(), x.getMonth(), x.getDate())
  }
  const da = toUTCDate(a)
  const db = toUTCDate(b)
  const ms = 24*60*60*1000
  return Math.floor((db - da)/ms)
}

// 定位心形背景与生成涟漪环
function positionHeartToCount(){
  const panel = document.querySelector('.panel.story-panel')
  const countWrap = panel && panel.querySelector('.count-wrap')
  if(!panel || !countWrap) return
  const panelRect = panel.getBoundingClientRect()
  const countRect = countWrap.getBoundingClientRect()
  const absCenterX = countRect.left + countRect.width/2
  const absCenterY = countRect.top + countRect.height/2
  const padding = 12
  let heartSize = Math.max(60, Math.round(Math.max(countRect.width, countRect.height) + padding))
  const vw = window.innerWidth || document.documentElement.clientWidth || 360
  let maxSizeByVw
  if(vw <= 480) maxSizeByVw = Math.round(Math.min(panelRect.width * 0.44, 100))
  else if(vw <= 768) maxSizeByVw = Math.round(Math.min(panelRect.width * 0.5, 120))
  else if(vw <= 1024) maxSizeByVw = Math.round(Math.min(panelRect.width * 0.45, 160))
  else maxSizeByVw = Math.round(Math.min(panelRect.width * 0.5, 260))
  heartSize = Math.min(heartSize, maxSizeByVw)
  if(vw <= 1024) heartSize = Math.max(40, Math.round(heartSize * 0.95))
  if(vw >= 1024){ heartSize = Math.min(Math.round(heartSize * 1.15), maxSizeByVw) }
  const actionBtn = panel.querySelector('#celebrate')
  if(actionBtn){
    const btnRect = actionBtn.getBoundingClientRect()
    const distToBtnTop = btnRect.top - absCenterY
    if(distToBtnTop > 0){ const allowedHalf = Math.max(20, Math.floor(distToBtnTop - 12)); heartSize = Math.min(heartSize, allowedHalf*2) }
  }
  let relX = Math.round(absCenterX - panelRect.left)
  let relY = Math.round(absCenterY - panelRect.top)
  // small downward adjustment to visually center the heart (约 5px)
  relY += 5
  const margin = Math.round(heartSize * 0.25)
  const minX = margin
  const maxX = Math.max(margin, Math.round(panelRect.width - margin))
  const minY = margin
  const maxY = Math.max(margin, Math.round(panelRect.height - margin))
  if(vw <= 768){ relY = relY - Math.round(heartSize * 0.06) }
  else if(vw <= 1024){ relY = relY - Math.round(heartSize * 0.03) }
  relX = Math.max(minX, Math.min(relX, maxX))
  relY = Math.max(minY, Math.min(relY, maxY))
  panel.style.setProperty('--heart-left', relX + 'px')
  panel.style.setProperty('--heart-top', relY + 'px')
  panel.style.setProperty('--heart-size', heartSize + 'px')
  const rippleCount = 7
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--heart-beat-duration') || '1s'
  const beatSec = Math.max(0.2, parseFloat(raw)) || 1
  const totalDur = Math.max(beatSec * (rippleCount + 1) * 0.6, 1.2)
  const emitSpacing = beatSec * 0.6
  for(let i=1;i<=rippleCount;i++){
    let el = panel.querySelector('.ripple-ring.r'+i)
    if(!el){ el = document.createElement('div'); el.className = 'ripple-ring r'+i; panel.appendChild(el) }
    el.style.left = relX + 'px'
    el.style.top = relY + 'px'
    const ringSize = Math.round(heartSize * 1.4)
    el.style.width = ringSize + 'px'
    el.style.height = ringSize + 'px'
    el.style.animation = `ripple-ring ${totalDur}s infinite cubic-bezier(.22,.84,.31,1)`
    el.style.animationDelay = `${(i-1) * emitSpacing}s`
    el.style.borderColor = 'rgba(255,92,138,0.18)'
    el.style.opacity = ''
  }
}

// 弹出备注编辑框（模态）
function showNotePopup(dateStr, meeting, onSave){
  let overlay = document.getElementById('calendar-note-modal')
  if(overlay) overlay.remove()
  overlay = document.createElement('div')
  overlay.id = 'calendar-note-modal'
  overlay.style.position = 'fixed'
  overlay.style.left = '0'
  overlay.style.top = '0'
  overlay.style.right = '0'
  overlay.style.bottom = '0'
  overlay.style.display = 'flex'
  overlay.style.alignItems = 'center'
  overlay.style.justifyContent = 'center'
  overlay.style.zIndex = '10000'
  overlay.style.background = 'rgba(0,0,0,0.28)'

  const inner = document.createElement('div')
  inner.style.width = '360px'
  inner.style.maxWidth = '92%'
  inner.style.background = 'white'
  inner.style.borderRadius = '12px'
  inner.style.padding = '16px'
  inner.style.boxShadow = '0 20px 40px rgba(0,0,0,0.12)'
  inner.style.position = 'relative'

  const hdr = document.createElement('div')
  hdr.style.fontWeight = '700'
  hdr.style.marginBottom = '8px'
  hdr.textContent = dateStr
  inner.appendChild(hdr)

  const ta = document.createElement('textarea')
  ta.rows = 4
  ta.style.width = '100%'
  ta.style.boxSizing = 'border-box'
  ta.placeholder = '备注（可选）'
  ta.value = (meeting && meeting.note) ? meeting.note : ''
  inner.appendChild(ta)

  const btnWrap = document.createElement('div')
  btnWrap.style.display = 'flex'
  btnWrap.style.justifyContent = 'flex-end'
  btnWrap.style.gap = '8px'
  btnWrap.style.marginTop = '12px'

  const cancelBtn = document.createElement('button')
  cancelBtn.className = 'btn ghost'
  cancelBtn.textContent = '取消'
  const saveBtn = document.createElement('button')
  saveBtn.className = 'btn'
  saveBtn.textContent = '保存'

  if(meeting && meeting.id){
    const delBtn = document.createElement('button')
    delBtn.className = 'btn ghost'
    delBtn.textContent = '删除'
    delBtn.addEventListener('click', async ()=>{
      if(!confirm('确认删除该记录？')) return
      try{
        await deleteMeeting(meeting.id)
        if(typeof onSave === 'function') onSave('')
        showToast('已删除')
      }catch(e){ showToast('删除失败','error') }
      close()
    })
    btnWrap.appendChild(delBtn)
  }

  btnWrap.appendChild(cancelBtn)
  btnWrap.appendChild(saveBtn)
  inner.appendChild(btnWrap)
  overlay.appendChild(inner)
  document.body.appendChild(overlay)
  ta.focus()

  function close(){ overlay.remove(); document.removeEventListener('keydown', onKey) }
  saveBtn.addEventListener('click', ()=>{
    const note = ta.value.trim()
    if(typeof onSave === 'function') onSave(note)
    close()
  })
  cancelBtn.addEventListener('click', ()=> close())
  overlay.addEventListener('click', (ev)=>{ if(ev.target === overlay) close() })
  function onKey(e){ if(e.key === 'Escape') close() }
  document.addEventListener('keydown', onKey)
}
 

// Use shared `parseInputToDates` imported from shared/dateParser.js

// 日历渲染（显示指定年月，并回调点击事件）
function renderCalendar(meetings, onDateClick, year, month, minYear){
  const calendarEl = document.getElementById('calendar-view')
  if(!calendarEl) return
  calendarEl.innerHTML = ''
  // build a map of meetings by date (ISO yyyy-mm-dd) so we can mark notes
  const meetingMap = new Map(meetings.map(m => {
    const key = (m && m.date) ? (m.date.split('T')[0]) : m.date
    return [key, m]
  }))
  const dateSet = new Set(Array.from(meetingMap.keys()))
  const today = new Date()
  year = typeof year === 'number' ? year : today.getFullYear()
  month = typeof month === 'number' ? month : today.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month+1, 0)
  const startWeek = firstDay.getDay() || 7
  const daysInMonth = lastDay.getDate()

  // header with combined selectors (保留下拉作为唯一控件)
  const header = document.createElement('div')
  header.className = 'calendar-header'
  header.style.display = 'flex'
  header.style.justifyContent = 'space-between'
  header.style.alignItems = 'center'
  header.style.marginBottom = '8px'

  const left = document.createElement('div')
  left.style.display = 'flex'
  left.style.alignItems = 'center'
  left.style.gap = '12px'

  // year/month selectors (年份范围按当前时间与 firstMeetingYear 动态获取)
  const yearSel = document.createElement('select')
  const monthSel = document.createElement('select')
  const now = new Date()
  const nowYear = now.getFullYear()
  const nowMonth = now.getMonth()
  // prefer minYear param (来自 createApp 的 firstMeetingYear)，否则向后兼容默认
  const minY = (typeof minYear === 'number' && minYear) ? minYear : Math.max(nowYear - 5, year - 3)
  const maxY = nowYear
  for(let y = minY; y <= maxY; y++){
    const o = document.createElement('option'); o.value = y; o.textContent = y + '年'; if(y === year) o.selected = true; yearSel.appendChild(o)
  }
  // helper to (re)build month options according to selected year (prevent selecting future months)
  function buildMonthOptions(forYear){
    monthSel.innerHTML = ''
    const maxM = (forYear === nowYear) ? nowMonth : 11
    for(let m=0;m<=maxM;m++){
      const o = document.createElement('option')
      o.value = m
      o.textContent = (m+1) + '月'
      if(m === month) o.selected = true
      monthSel.appendChild(o)
    }
    // if current selected month greater than maxM, clamp selection to maxM
    if(Number(monthSel.value) > maxM) monthSel.value = String(maxM)
  }
  buildMonthOptions(year)
  yearSel.style.marginRight = '8px'
  yearSel.className = 'calendar-select'
  monthSel.className = 'calendar-select'

  left.appendChild(yearSel)
  left.appendChild(monthSel)

  // keep the calendar title concise (optional small label)
  const title = document.createElement('div')
  title.style.fontWeight = '700'
  title.textContent = '' // merged into selectors; 保留为空以避免重复显示

  header.appendChild(left)
  header.appendChild(title)
  calendarEl.appendChild(header)

  const table = document.createElement('table')
  table.className = 'calendar-table'
  const thead = document.createElement('thead')
  thead.innerHTML = '<tr><th>一</th><th>二</th><th>三</th><th>四</th><th>五</th><th>六</th><th>日</th></tr>'
  table.appendChild(thead)
  const tbody = document.createElement('tbody')
  let tr = document.createElement('tr')
  for(let i=1;i<startWeek;i++) tr.appendChild(document.createElement('td'))
  for(let d=1; d<=daysInMonth; d++){
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    const td = document.createElement('td')
    td.className = 'calendar-day'
    td.dataset.date = dateStr
    td.textContent = d
    if(dateSet.has(dateStr)) td.classList.add('has-meeting')
    const meeting = meetingMap.get(dateStr)
    // if this date's meeting has a note, add marker class
    if(meeting && meeting.note) td.classList.add('has-note')
    td.addEventListener('click', ()=> onDateClick && onDateClick(dateStr))
    tr.appendChild(td)
    if((startWeek + d - 1) % 7 === 0){ tbody.appendChild(tr); tr = document.createElement('tr') }
  }
  if(tr.children.length){ while(tr.children.length < 7) tr.appendChild(document.createElement('td')); tbody.appendChild(tr) }
  table.appendChild(tbody)
  calendarEl.appendChild(table)

  // navigation handled by下拉选择控件
  yearSel.addEventListener('change', ()=>{
    const ny = Number(yearSel.value)
    // rebuild month options for the newly selected year to prevent future months
    buildMonthOptions(ny)
    const nm = Number(monthSel.value)
    document.dispatchEvent(new CustomEvent('calendar:change', { detail: { year: ny, month: nm } }))
  })
  monthSel.addEventListener('change', ()=>{
    const ny = Number(yearSel.value)
    const nm = Number(monthSel.value)
    document.dispatchEvent(new CustomEvent('calendar:change', { detail: { year: ny, month: nm } }))
  })

  // 平板/手机端支持左右滑动切换上/下个月（PC 不启用）
  const isTouchCapable = ('ontouchstart' in window) || window.matchMedia && window.matchMedia('(pointer:coarse)').matches
  // helper: debounce calendar change dispatch for touch swipes to avoid rapid re-renders
  function scheduleCalendarChange(ny, nm){
    // attach timer to calendarEl so multiple renderCalendar calls won't clash
    if(calendarEl._calChangeTimer) clearTimeout(calendarEl._calChangeTimer)
    calendarEl._calChangeTimer = setTimeout(()=>{
      calendarEl._calChangeTimer = null
      document.dispatchEvent(new CustomEvent('calendar:change', { detail: { year: ny, month: nm } }))
    }, 100)
  }
  if(isTouchCapable){
    let sx = 0, sy = 0, tracking = false, touchId = null
    calendarEl.addEventListener('touchstart', (ev)=>{
      const t = ev.touches[0]
      if(!t) return
      touchId = t.identifier
      sx = t.clientX; sy = t.clientY; tracking = true
    }, { passive: true })
    calendarEl.addEventListener('touchmove', ()=>{/* passive, no-op */}, { passive: true })
    calendarEl.addEventListener('touchcancel', ()=>{ tracking = false; touchId = null }, { passive: true })
    calendarEl.addEventListener('touchend', (ev)=>{
      if(!tracking) return
      // find the matching changed touch by identifier
      let t = ev.changedTouches[0]
      for(let i=0;i<ev.changedTouches.length;i++){ if(ev.changedTouches[i].identifier === touchId){ t = ev.changedTouches[i]; break } }
      tracking = false; touchId = null
      if(!t) return
      const dx = t.clientX - sx
      const dy = t.clientY - sy
      const absX = Math.abs(dx), absY = Math.abs(dy)
      const MIN_SWIPE = 30
      if(absX > MIN_SWIPE && absX > absY){
        let ny = year, nm = month
        if(dx < 0){ // left -> next month
          nm = month + 1
          if(nm > 11){ nm = 0; ny = year + 1 }
        } else { // right -> prev month
          nm = month - 1
          if(nm < 0){ nm = 11; ny = year - 1 }
        }
        // enforce allowed range: minY (from above) .. nowYear/nowMonth
        const now = new Date()
        const nowYear = now.getFullYear()
        const nowMonth = now.getMonth()
        // clamp year/month upper bound
        if(ny > nowYear){ ny = nowYear; nm = nowMonth }
        if(ny === nowYear && nm > nowMonth) nm = nowMonth
        // clamp lower bound if minY provided
        if(typeof minY === 'number' && minY){ if(ny < minY){ ny = minY; nm = 0 } }
        // if nothing changes, avoid dispatching
        if(ny === year && nm === month) return
        // schedule a debounced dispatch to avoid rapid successive re-renders
        scheduleCalendarChange(ny, nm)
      }
    }, { passive: true })
  }
}

// 内联日历弹窗实现已移除；保留顶部模态 `showNotePopup` 实现以统一行为。



async function createApp(){
  const root = document.getElementById('app')
  // check auth by probing settings endpoint; if unauthorized, show login
  try{
    await apiFetch(API_ROOT + '/api/settings')
  }catch(e){
    return showLogin(root)
  }

  root.innerHTML = `
  <div class="card">
    <div class="header">
      <div>
        <div class="title">我们的见面记录</div>
        <div class="subtitle">记录每一次相聚，记录属于我们的时光</div>
      </div>
      <div class="header-right">
        <div class="big-counter" id="days-counter">0 天</div>
        <div class="muted">从第一次相遇算起</div>
        <div class="header-actions">
          <button class="btn ghost" id="change-pass">修改密码</button>
          <button class="btn ghost" id="logout">登出</button>
        </div>
      </div>
    </div>

    <div class="grid">
      <div class="panel">
        <div class="muted">添加一次见面</div>
        <form id="meet-form">
          <input id="meet-date" type="date" />
          <textarea id="meet-input" rows="2" placeholder="可输入：20250101 或 20250101~20250105（支持 〜、-、~），或用逗号/顿号/分号/空格/换行分隔多项"></textarea>
          <textarea id="meet-note" rows="2" placeholder="备注（可选）"></textarea>
          <div class="controls">
            <button class="btn" type="submit">添加</button>
          </div>
        </form>
        <div class="muted" style="margin-top:12px">历史日历</div>
        <div id="calendar-view" style="margin-top:8px"></div>
        <div id="calendar-note-popup"></div>
      </div>

      <div>
        <div class="panel story-panel" style="text-align:center;position:relative;overflow:visible;height:100%">
          <div style="font-weight:700;color:var(--accent);font-size:18px">我们的故事</div>
          <div style="margin-top:12px;color:var(--muted)">每一次相聚，都是我最想收藏的日子。</div>
          <div style="margin-top:20px">
            <div class="count-wrap" style="display:inline-block;padding:8px 18px;border-radius:6px;">
              <div class="muted" style="text-align:center">总次数</div>
              <div id="total-count" style="font-size:34px;font-weight:800;color:var(--accent);text-align:center">0</div>
            </div>
          </div>
          <div style="margin-top:18px">
            <button class="btn" id="celebrate">为她点个心</button>
            <button class="btn ghost" id="set-first" style="margin-left:10px">设初次见面</button>
          </div>
          <!-- background heart and ripples implemented in CSS ::before / ::after on .story-panel -->
        </div>
      </div>
    </div>

    <div class="floating-hearts" id="floating-hearts"></div>
  </div>
  `

  const form = document.getElementById('meet-form')
  const daysCounter = document.getElementById('days-counter')
  const totalCount = document.getElementById('total-count')
  const celebrateBtn = document.getElementById('celebrate')
  const setFirstBtn = document.getElementById('set-first')
  const changePassBtn = document.getElementById('change-pass')
  const logoutBtn = document.getElementById('logout')

  let meetings = []
  let limit = 1000 // 日历模式下默认加载全部
  let offset = 0
  let total = 0
  // 日历当前显示的年月（初始为本月）
  let calYear = new Date().getFullYear()
  let calMonth = new Date().getMonth()
  let firstMeetingYear = null

  async function render(reload = true){
    // fetch meetings and settings (全部加载)
    try{
      if(reload){ offset = 0 }
      const res = await apiFetch(API_ROOT + `/api/meetings?limit=${limit}&offset=${offset}`)
      const json = await res.json()
      meetings = json.rows || []
      total = json.total || 0
    }catch(e){
      if(String(e).includes('unauthorized')) return showLogin(root)
      console.error(e)
      meetings = []
      total = 0
    }
    meetings = meetings.map(m=>({ ...m, date: (m && m.date && typeof m.date === 'string') ? m.date.split('T')[0] : m.date }))
    meetings.sort((a,b)=> new Date(b.date) - new Date(a.date))
    // 先计算首个见面时间（用作日历起点）
    let firstDate = null
    try{
      const sres = await apiFetch(API_ROOT + '/api/settings')
      const sjson = await sres.json()
      firstDate = sjson.first_meeting
    }catch(e){ }
    if(!firstDate && meetings.length){
      const times = meetings.map(m => {
        const s = (m && m.date) ? m.date.split('T')[0] : ''
        const [y,mo,da] = (s||'').split('-').map(Number)
        return new Date(Date.UTC(y||1970, (mo||1)-1, da||1))
      }).sort((a,b)=>a-b)
      firstDate = times.length ? dateToISO(times[0]) : null
    }
    if(firstDate){ firstMeetingYear = Number(firstDate.split('-')[0]) }
    // 若 calYear 小于 firstMeetingYear，则将 calYear 调整为 firstMeetingYear
    if(firstMeetingYear && calYear < firstMeetingYear) calYear = firstMeetingYear

    // 日历渲染（使用当前 calYear/calMonth）
    renderCalendar(meetings, (dateStr) => {
      const meeting = meetings.find(m => m.date === dateStr)
      showNotePopup(dateStr, meeting, async (note) => {
        if(meeting){
          await updateMeetingNote(meeting.id, note)
          showToast('备注已保存')
        }else if(note){
          await insertMeetings(dateStr, note)
          showToast('已添加记录')
        }
        // 通知并刷新
        document.dispatchEvent(new CustomEvent('meetings:changed'))
      })
    }, calYear, calMonth, firstMeetingYear)
    // 总次数
    totalCount.textContent = total
    // 天数计数（使用之前计算的 firstDate）
    if(firstDate){
      const days = daysBetween(firstDate, new Date())
      daysCounter.textContent = `${days} 天`
    } else {
      daysCounter.textContent = `0 天`
    }
    // ensure heart positioned after layout
    setTimeout(()=> positionHeartToCount(), 80)
  }

  // 移除历史列表和loadMore相关事件绑定
  // listEl.addEventListener ...
  // const loadMoreBtn = document.getElementById('load-more')
  // if(loadMoreBtn) loadMoreBtn.addEventListener ...

  // 其它事件绑定保持不变
  // 当外部操作（如删除）修改记录时，重新渲染
  document.addEventListener('meetings:changed', ()=>{ render(true).catch(()=>{}) })
  // 监听日历导航事件以切换显示年月并重渲染（不重新请求数据）
  document.addEventListener('calendar:change', (evt)=>{
    const d = evt && evt.detail
    if(!d) return
    calYear = Number(d.year)
    calMonth = Number(d.month)
    // 直接渲染日历（使用当前已经加载的 meetings）
    renderCalendar(meetings, (dateStr) => {
      const meeting = meetings.find(m => m.date === dateStr)
      showNotePopup(dateStr, meeting, async (note) => {
        if(meeting){ await updateMeetingNote(meeting.id, note); showToast('备注已保存') }
        else if(note){ await insertMeetings(dateStr, note); showToast('已添加记录') }
        document.dispatchEvent(new CustomEvent('meetings:changed'))
      })
    }, calYear, calMonth, firstMeetingYear)
    // reposition heart after layout
    setTimeout(()=> positionHeartToCount(), 60)
  })
  form.addEventListener('submit', async (e)=>{
    e.preventDefault()
    const date = document.getElementById('meet-date').value
    const inputText = document.getElementById('meet-input').value.trim()
    const note = document.getElementById('meet-note').value.trim()
    const payload = inputText || date
    if(!payload) return
    // pre-parse client-side and auto-dedupe against currently loaded meetings
    const parsed = parseInputToDates(payload)
    if(parsed.length === 0){ showToast('未解析到有效的日期', 'error'); return }
    const existingSet = new Set(meetings.map(m=> (m && m.date) ? m.date.split('T')[0] : m.date ))
    const newDates = parsed.filter(d=> !existingSet.has(d))
    const dupes = parsed.filter(d=> existingSet.has(d))
    if(newDates.length === 0){
      showToast('所填日期均已存在，未添加：\n' + (dupes.join(', ')), 'info')
      return
    }
    if(dupes.length){
      // Inform user which dates will be skipped (non-blocking)
      showToast('下列日期已存在，将被跳过：\n' + dupes.join(', '), 'info')
    }
    // send only new dates as comma-separated ISO strings
    const sendPayload = newDates.join(',')
    try{
      const data = await insertMeetings(sendPayload, note)
      const ins = (data && data.inserted) ? data.inserted.map(i=>i.date) : []
      const skipped = (data && data.skipped) ? data.skipped : []
      if(ins.length) showToast('已添加：' + ins.join(', '), 'info')
      if(skipped.length) showToast('已存在（跳过）：' + skipped.join(', '), 'info')
      form.reset()
      // reload first page and then highlight new items
      await render(true)
      if(ins.length){
        // highlight and scroll to first inserted
        const first = ins[0]
        const el = document.querySelector(`.meet-item[data-date="${first}"]`)
        if(el){ el.classList.add('highlight'); el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          setTimeout(()=> el.classList.remove('highlight'), 2200)
        }
      }
    }catch(err){ if(String(err).includes('unauthorized')) return showLogin(root); console.error(err) }
  })

  // 已移除“清空记录”功能

  celebrateBtn.addEventListener('click', ()=>{
    // 仅产生漂浮爱心效果，不改变 ripple 的自然循环
    burstHearts(12)
  })

  // set first meeting
  if(setFirstBtn){
    setFirstBtn.addEventListener('click', async ()=>{
      const val = prompt('请输入第一次见面时间（YYYY-MM-DD）:')
      if(!val) return
      try{
        await apiFetch(API_ROOT + '/api/first-meeting', { method:'POST', body: JSON.stringify({ date: val }) })
        alert('设置成功')
        render()
      }catch(err){ if(String(err).includes('unauthorized')) return showLogin(root); alert('设置失败') }
    })
  }

  // change password
  if(changePassBtn){
    changePassBtn.addEventListener('click', async ()=>{
      const np = prompt('请输入新密码:')
      if(!np) return
      try{
        await apiFetch(API_ROOT + '/api/password', { method:'POST', body: JSON.stringify({ newPassword: np }) })
        alert('密码已修改')
      }catch(err){ if(String(err).includes('unauthorized')) return showLogin(root); alert('修改失败') }
    })
  }

  if(logoutBtn){
    logoutBtn.addEventListener('click', async ()=>{
      try{ await apiFetch(API_ROOT + '/api/logout', { method:'POST' }) }catch(e){}
      showLogin(root)
    })
  }

  function burstHearts(n){
    const container = document.getElementById('floating-hearts')
    for(let i=0;i<n;i++){
      const h = document.createElement('div')
      h.className = 'h'
      // distribute hearts across the viewport (less concentrated)
      // wider horizontal and vertical spread to feel lively
      const vw = Math.max(window.innerWidth || 360, 360)
      // for mobile, keep them closer to center-top area but still varied
      if(vw < 480){
        h.style.left = (10 + Math.random()*80) + '%'
        h.style.bottom = (6 + Math.random()*28) + '%'
      } else if(vw < 900){
        h.style.left = (6 + Math.random()*88) + '%'
        h.style.bottom = (6 + Math.random()*40) + '%'
      } else {
        h.style.left = (2 + Math.random()*96) + '%'
        h.style.bottom = (4 + Math.random()*60) + '%'
      }
      // random small size to look delicate
      const size = 10 + Math.round(Math.random()*12)
      h.style.width = size + 'px'
      h.style.height = size + 'px'
      const dur = 2.0 + Math.random()*1.6
      h.style.animationDuration = dur + 's'
      h.style.opacity = (0.7 + Math.random()*0.25).toFixed(2)
      // insert a small inline SVG heart (scales to container)
      h.innerHTML = `<svg viewBox="0 0 32 29.6" aria-hidden="true"><path d="M23.6,0C20.4,0,17.9,1.8,16,4.1C14.1,1.8,11.6,0,8.4,0C3.8,0,0,3.8,0,8.4c0,9.8,16,21.2,16,21.2s16-11.4,16-21.2C32,3.8,28.2,0,23.6,0z"></path></svg>`
      // slight rotation variation
      h.style.transform = `rotate(${Math.round(-15 + Math.random()*30)}deg)`
      h.classList.add('animate')
      container.appendChild(h)
      setTimeout(()=> h.remove(), (dur+0.3)*1000)
    }
  }

  // 新增：更新备注API
  async function updateMeetingNote(id, note){
    return apiFetch(API_ROOT + `/api/meetings/${id}`, { method: 'POST', body: JSON.stringify({ note }) })
  }

  render()
}

// show login UI
function showLogin(root){
  root.innerHTML = `
    <div class="card" style="max-width:420px; margin:48px auto;">
      <div style="text-align:center;padding:18px">
        <div style="font-size:20px;font-weight:700;color:var(--accent)">请先登录</div>
        <div class="muted" style="margin-top:6px">请输入密码以访问记录</div>
      </div>
      <div style="padding:12px">
        <input id="login-pass" type="password" placeholder="密码" style="width:100%;padding:10px;border-radius:8px;border:1px solid rgba(0,0,0,0.08)" />
        <div style="display:flex;gap:8px;margin-top:12px">
          <button class="btn" id="login-btn">登录</button>
        </div>
        <div style="margin-top:10px;color:var(--muted);font-size:13px">初始密码为 5201314</div>
      </div>
    </div>
  `
  const passEl = document.getElementById('login-pass')
  const btn = document.getElementById('login-btn')
  btn.addEventListener('click', async ()=>{
    const pass = passEl.value || ''
    try{
      const res = await fetch(API_ROOT + '/api/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ password: pass }), credentials: 'include' })
      if(res.status !== 200){ alert('登录失败'); return }
      createApp()
    }catch(err){ alert('登录出错') }
  })
}

document.addEventListener('DOMContentLoaded', ()=>{ createApp().catch(err=>{ console.error(err); const root=document.getElementById('app'); showLogin(root) }) })
