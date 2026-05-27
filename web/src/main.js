// src/main.js
import { parseInputToDates, formatDateObj } from './utils/dateParser.js'
import { meetingsAPI, settingsAPI, authAPI } from './utils/api.js'
import { showToast, showNotePopup } from './utils/ui.js'
import { 
  RIPPLE_RING_COUNT, 
  CALENDAR_DEBOUNCE, 
  HEART_BURST_COUNT, 
  HEART_POSITION_DELAY 
} from './utils/constants.js'

// 全局状态管理
let appState = {
  meetings: [],
  total: 0,
  calYear: new Date().getFullYear(),
  calMonth: new Date().getMonth(),
  firstMeetingYear: null,
  firstMeetingDate: null
}

/**
 * 格式化日期显示
 * @param {string|Date} d - 日期
 * @returns {string} 本地化日期字符串
 */
function fmt(d) {
  try {
    const dateStr = typeof d === 'string' ? d.split('T')[0] : d
    const [y, mo, da] = (dateStr || '').split('-').map(Number)
    if (!y) return d
    return new Date(y, (mo || 1) - 1, da || 1).toLocaleDateString()
  } catch (e) {
    return d
  }
}

/**
 * 计算两个日期之间的天数
 * @param {string|Date} a - 开始日期
 * @param {string|Date} b - 结束日期
 * @returns {number} 天数差
 */
function daysBetween(a, b) {
  function toUTCTimestamp(x) {
    if (typeof x === 'string') {
      const [y, mo, da] = x.split('T')[0].split('-').map(Number)
      return Date.UTC(y, (mo || 1) - 1, da || 1)
    }
    return Date.UTC(x.getFullYear(), x.getMonth(), x.getDate())
  }
  
  const ONE_DAY = 24 * 60 * 60 * 1000
  return Math.floor((toUTCTimestamp(b) - toUTCTimestamp(a)) / ONE_DAY)
}

/**
 * 定位心形背景与生成涟漪环
 */
function positionHeartToCount() {
  const panel = document.querySelector('.panel.story-panel')
  const countWrap = panel?.querySelector('.count-wrap')
  if (!panel || !countWrap) return

  const panelRect = panel.getBoundingClientRect()
  const countRect = countWrap.getBoundingClientRect()
  const absCenterX = countRect.left + countRect.width / 2
  const absCenterY = countRect.top + countRect.height / 2
  const padding = 12

  let heartSize = Math.max(60, Math.round(Math.max(countRect.width, countRect.height) + padding))
  const vw = window.innerWidth || document.documentElement.clientWidth || 360

  // 响应式心形大小
  let maxSizeByVw
  if (vw <= 480) maxSizeByVw = Math.round(Math.min(panelRect.width * 0.44, 100))
  else if (vw <= 768) maxSizeByVw = Math.round(Math.min(panelRect.width * 0.5, 120))
  else if (vw <= 1024) maxSizeByVw = Math.round(Math.min(panelRect.width * 0.45, 160))
  else maxSizeByVw = Math.round(Math.min(panelRect.width * 0.5, 260))

  heartSize = Math.min(heartSize, maxSizeByVw)
  if (vw <= 1024) heartSize = Math.max(40, Math.round(heartSize * 0.95))
  if (vw >= 1024) heartSize = Math.min(Math.round(heartSize * 1.15), maxSizeByVw)

  // 避免与按钮重叠
  const actionBtn = panel.querySelector('#celebrate')
  if (actionBtn) {
    const btnRect = actionBtn.getBoundingClientRect()
    const distToBtnTop = btnRect.top - absCenterY
    if (distToBtnTop > 0) {
      const allowedHalf = Math.max(20, Math.floor(distToBtnTop - 12))
      heartSize = Math.min(heartSize, allowedHalf * 2)
    }
  }

  // 计算相对位置
  let relX = Math.round(absCenterX - panelRect.left)
  let relY = Math.round(absCenterY - panelRect.top) + 5 // 视觉居中微调

  const margin = Math.round(heartSize * 0.25)
  const minX = margin
  const maxX = Math.max(margin, Math.round(panelRect.width - margin))
  const minY = margin
  const maxY = Math.max(margin, Math.round(panelRect.height - margin))

  if (vw <= 768) relY -= Math.round(heartSize * 0.06)
  else if (vw <= 1024) relY -= Math.round(heartSize * 0.03)

  relX = Math.max(minX, Math.min(relX, maxX))
  relY = Math.max(minY, Math.min(relY, maxY))

  // 设置CSS变量
  panel.style.setProperty('--heart-left', `${relX}px`)
  panel.style.setProperty('--heart-top', `${relY}px`)
  panel.style.setProperty('--heart-size', `${heartSize}px`)

  // 生成涟漪环
  const rawBeatDuration = getComputedStyle(document.documentElement)
    .getPropertyValue('--heart-beat-duration') || '1s'
  const beatSec = Math.max(0.2, parseFloat(rawBeatDuration)) || 1
  const totalDur = Math.max(beatSec * (RIPPLE_RING_COUNT + 1) * 0.6, 1.2)
  const emitSpacing = beatSec * 0.6

  for (let i = 1; i <= RIPPLE_RING_COUNT; i++) {
    let ring = panel.querySelector(`.ripple-ring.r${i}`)
    if (!ring) {
      ring = document.createElement('div')
      ring.className = `ripple-ring r${i}`
      panel.appendChild(ring)
    }

    Object.assign(ring.style, {
      left: `${relX}px`,
      top: `${relY}px`,
      width: `${Math.round(heartSize * 1.4)}px`,
      height: `${Math.round(heartSize * 1.4)}px`,
      animation: `ripple-ring ${totalDur}s infinite cubic-bezier(.22,.84,.31,1)`,
      animationDelay: `${(i - 1) * emitSpacing}s`,
      borderColor: 'rgba(255,92,138,0.18)'
    })
  }
}

/**
 * 渲染日历
 * @param {function} onDateClick - 日期点击回调
 */
function renderCalendar(onDateClick) {
  const calendarEl = document.getElementById('calendar-view')
  if (!calendarEl) return

  calendarEl.innerHTML = ''

  // 构建日期-会议映射
  const meetingMap = new Map(
    appState.meetings.map(m => [m.date.split('T')[0], m])
  )
  const dateSet = new Set(meetingMap.keys())

  const today = new Date()
  const firstDay = new Date(appState.calYear, appState.calMonth, 1)
  const lastDay = new Date(appState.calYear, appState.calMonth + 1, 0)
  const startWeek = firstDay.getDay() || 7
  const daysInMonth = lastDay.getDate()

  // 日历头部
  const header = document.createElement('div')
  header.className = 'calendar-header'
  Object.assign(header.style, {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px'
  })

  const left = document.createElement('div')
  left.style.display = 'flex'
  left.style.alignItems = 'center'
  left.style.gap = '12px'

  // 年份选择器
  const yearSel = document.createElement('select')
  const monthSel = document.createElement('select')
  const nowYear = today.getFullYear()
  const nowMonth = today.getMonth()
  const minY = appState.firstMeetingYear || Math.max(nowYear - 5, appState.calYear - 3)
  const maxY = nowYear

  for (let y = minY; y <= maxY; y++) {
    const option = document.createElement('option')
    option.value = y
    option.textContent = `${y}年`
    if (y === appState.calYear) option.selected = true
    yearSel.appendChild(option)
  }

  // 构建月份选项（防止选择未来月份）
  function buildMonthOptions(selectedYear) {
    monthSel.innerHTML = ''
    const maxM = selectedYear === nowYear ? nowMonth : 11
    for (let m = 0; m <= maxM; m++) {
      const option = document.createElement('option')
      option.value = m
      option.textContent = `${m + 1}月`
      if (m === appState.calMonth) option.selected = true
      monthSel.appendChild(option)
    }
    if (Number(monthSel.value) > maxM) monthSel.value = String(maxM)
  }

  buildMonthOptions(appState.calYear)
  yearSel.className = 'calendar-select'
  monthSel.className = 'calendar-select'
  yearSel.style.marginRight = '8px'

  left.appendChild(yearSel)
  left.appendChild(monthSel)
  header.appendChild(left)
  calendarEl.appendChild(header)

  // 日历表格
  const table = document.createElement('table')
  table.className = 'calendar-table'

  // 表头
  const thead = document.createElement('thead')
  thead.innerHTML = '<tr><th>一</th><th>二</th><th>三</th><th>四</th><th>五</th><th>六</th><th>日</th></tr>'
  table.appendChild(thead)

  // 表体
  const tbody = document.createElement('tbody')
  let tr = document.createElement('tr')

  // 填充月初空白
  for (let i = 1; i < startWeek; i++) {
    tr.appendChild(document.createElement('td'))
  }

  // 填充日期
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${appState.calYear}-${String(appState.calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const td = document.createElement('td')
    td.className = 'calendar-day'
    td.dataset.date = dateStr
    td.textContent = d

    if (dateSet.has(dateStr)) {
      td.classList.add('has-meeting')
      const meeting = meetingMap.get(dateStr)
      if (meeting?.note) td.classList.add('has-note')
    }

    tr.appendChild(td)

    if ((startWeek + d - 1) % 7 === 0) {
      tbody.appendChild(tr)
      tr = document.createElement('tr')
    }
  }

  // 填充月末空白
  if (tr.children.length) {
    while (tr.children.length < 7) tr.appendChild(document.createElement('td'))
    tbody.appendChild(tr)
  }

  table.appendChild(tbody)
  calendarEl.appendChild(table)

  // 事件委托：日期点击（性能优化，避免每个td单独绑定）
  table.addEventListener('click', (e) => {
    const td = e.target.closest('.calendar-day')
    if (td && td.dataset.date) {
      onDateClick(td.dataset.date)
    }
  })

  // 年份/月份切换
  yearSel.addEventListener('change', () => {
    const newYear = Number(yearSel.value)
    buildMonthOptions(newYear)
    const newMonth = Number(monthSel.value)
    dispatchCalendarChange(newYear, newMonth)
  })

  monthSel.addEventListener('change', () => {
    const newYear = Number(yearSel.value)
    const newMonth = Number(monthSel.value)
    dispatchCalendarChange(newYear, newMonth)
  })

  // 防抖日历切换事件
  let calendarChangeTimer = null
  function dispatchCalendarChange(year, month) {
    if (calendarChangeTimer) clearTimeout(calendarChangeTimer)
    calendarChangeTimer = setTimeout(() => {
      document.dispatchEvent(new CustomEvent('calendar:change', {
        detail: { year, month }
      }))
    }, CALENDAR_DEBOUNCE)
  }

  // 移动端左右滑动切换月份
  const isTouchCapable = 'ontouchstart' in window || 
    window.matchMedia?.('(pointer:coarse)').matches

  if (isTouchCapable) {
    let startX = 0, startY = 0, tracking = false, touchId = null

    calendarEl.addEventListener('touchstart', (ev) => {
      const touch = ev.touches[0]
      if (!touch) return
      touchId = touch.identifier
      startX = touch.clientX
      startY = touch.clientY
      tracking = true
    }, { passive: true })

    calendarEl.addEventListener('touchend', (ev) => {
      if (!tracking) return

      let touch = null
      for (let i = 0; i < ev.changedTouches.length; i++) {
        if (ev.changedTouches[i].identifier === touchId) {
          touch = ev.changedTouches[i]
          break
        }
      }

      tracking = false
      touchId = null
      if (!touch) return

      const dx = touch.clientX - startX
      const dy = touch.clientY - startY
      const absX = Math.abs(dx)
      const absY = Math.abs(dy)
      const MIN_SWIPE = 30

      if (absX > MIN_SWIPE && absX > absY) {
        let newYear = appState.calYear
        let newMonth = appState.calMonth

        if (dx < 0) { // 左滑：下个月
          newMonth++
          if (newMonth > 11) {
            newMonth = 0
            newYear++
          }
        } else { // 右滑：上个月
          newMonth--
          if (newMonth < 0) {
            newMonth = 11
            newYear--
          }
        }

        // 限制日期范围
        if (newYear > nowYear || (newYear === nowYear && newMonth > nowMonth)) {
          newYear = nowYear
          newMonth = nowMonth
        }

        if (appState.firstMeetingYear && newYear < appState.firstMeetingYear) {
          newYear = appState.firstMeetingYear
          newMonth = 0
        }

        if (newYear !== appState.calYear || newMonth !== appState.calMonth) {
          dispatchCalendarChange(newYear, newMonth)
        }
      }
    }, { passive: true })
  }
}

/**
 * 生成漂浮爱心效果
 * @param {number} count - 爱心数量
 */
function burstHearts(count) {
  const container = document.getElementById('floating-hearts')
  if (!container) return

  for (let i = 0; i < count; i++) {
    const heart = document.createElement('div')
    heart.className = 'h animate'

    const vw = Math.max(window.innerWidth || 360, 360)
    
    // 响应式分布
    if (vw < 480) {
      heart.style.left = `${10 + Math.random() * 80}%`
      heart.style.bottom = `${6 + Math.random() * 28}%`
    } else if (vw < 900) {
      heart.style.left = `${6 + Math.random() * 88}%`
      heart.style.bottom = `${6 + Math.random() * 40}%`
    } else {
      heart.style.left = `${2 + Math.random() * 96}%`
      heart.style.bottom = `${4 + Math.random() * 60}%`
    }

    // 随机大小和动画时长
    const size = 10 + Math.round(Math.random() * 12)
    heart.style.width = `${size}px`
    heart.style.height = `${size}px`
    
    const duration = 2.0 + Math.random() * 1.6
    heart.style.animationDuration = `${duration}s`
    heart.style.opacity = (0.7 + Math.random() * 0.25).toFixed(2)
    heart.style.transform = `rotate(${Math.round(-15 + Math.random() * 30)}deg)`

    // 内联SVG爱心
    heart.innerHTML = `<svg viewBox="0 0 32 29.6" aria-hidden="true"><path d="M23.6,0C20.4,0,17.9,1.8,16,4.1C14.1,1.8,11.6,0,8.4,0C3.8,0,0,3.8,0,8.4c0,9.8,16,21.2,16,21.2s16-11.4,16-21.2C32,3.8,28.2,0,23.6,0z"></path></svg>`

    container.appendChild(heart)

    // 动画结束后自动移除
    setTimeout(() => heart.remove(), (duration + 0.3) * 1000)
  }
}

/**
 * 渲染应用
 * @param {boolean} reload - 是否重新加载数据
 */
async function render(reload = true) {
  try {
    if (reload) {
      // 加载会议数据
      const meetingsData = await meetingsAPI.getAll()
      appState.meetings = (meetingsData.rows || []).map(m => ({
        ...m,
        date: m.date.split('T')[0]
      })).sort((a, b) => new Date(b.date) - new Date(a.date))
      appState.total = meetingsData.total || 0

      // 加载设置（首次见面日期）
      try {
        const settings = await settingsAPI.get()
        appState.firstMeetingDate = settings.first_meeting
      } catch (e) {
        // 如果没有设置，从最早的会议记录推断
        if (appState.meetings.length) {
          const sortedDates = appState.meetings
            .map(m => new Date(Date.UTC(...m.date.split('-').map(Number))))
            .sort((a, b) => a - b)
          appState.firstMeetingDate = formatDateObj(sortedDates[0])
        }
      }

      if (appState.firstMeetingDate) {
        appState.firstMeetingYear = Number(appState.firstMeetingDate.split('-')[0])
        // 确保日历不会显示早于首次见面的年份
        if (appState.calYear < appState.firstMeetingYear) {
          appState.calYear = appState.firstMeetingYear
        }
      }
    }

    // 渲染日历
    renderCalendar((dateStr) => {
      const meeting = appState.meetings.find(m => m.date === dateStr)
      showNotePopup(
        dateStr,
        meeting,
        // 保存回调
        async (note) => {
          try {
            if (meeting) {
              await meetingsAPI.updateNote(meeting.id, note)
              showToast('备注已保存')
            } else if (note) {
              await meetingsAPI.create(dateStr, note)
              showToast('已添加记录')
            }
            document.dispatchEvent(new CustomEvent('meetings:changed'))
          } catch (e) {
            showToast('操作失败', 'error')
          }
        },
        // 删除回调
        async (id) => {
          await meetingsAPI.delete(id)
          document.dispatchEvent(new CustomEvent('meetings:changed'))
        }
      )
    })

    // 更新统计数据
    document.getElementById('total-count').textContent = appState.total
    
    if (appState.firstMeetingDate) {
      const days = daysBetween(appState.firstMeetingDate, new Date())
      document.getElementById('days-counter').textContent = `${days} 天`
    } else {
      document.getElementById('days-counter').textContent = '0 天'
    }

    // 延迟定位心形（等待布局完成）
    setTimeout(positionHeartToCount, HEART_POSITION_DELAY)
  } catch (e) {
    if (String(e).includes('unauthorized')) {
      showLogin()
    } else {
      console.error('渲染失败:', e)
      showToast('加载数据失败', 'error')
    }
  }
}

/**
 * 显示登录界面
 */
function showLogin() {
  const root = document.getElementById('app')
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
        <div style="margin-top:10px;color:var(--muted);font-size:13px">初始密码为 REDACTED</div>
      </div>
    </div>
  `

  const passEl = document.getElementById('login-pass')
  const loginBtn = document.getElementById('login-btn')

  const handleLogin = async () => {
    const password = passEl.value.trim()
    if (!password) return

    try {
      const response = await authAPI.login(password)
      if (response.status === 200) {
        createApp()
      } else {
        alert('登录失败')
      }
    } catch (err) {
      alert('登录出错')
    }
  }

  loginBtn.addEventListener('click', handleLogin)
  passEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleLogin()
  })
}

/**
 * 创建应用主界面
 */
async function createApp() {
  const root = document.getElementById('app')

  // 验证登录状态
  try {
    await settingsAPI.get()
  } catch (e) {
    return showLogin()
  }

  // 渲染主界面
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
        </div>
      </div>
    </div>

    <div class="floating-hearts" id="floating-hearts"></div>
  </div>
  `

  // 绑定事件
  bindEvents()

  // 初始渲染
  await render()
}

/**
 * 绑定所有事件监听
 */
function bindEvents() {
  const form = document.getElementById('meet-form')
  const celebrateBtn = document.getElementById('celebrate')
  const setFirstBtn = document.getElementById('set-first')
  const changePassBtn = document.getElementById('change-pass')
  const logoutBtn = document.getElementById('logout')

  // 表单提交
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const dateInput = document.getElementById('meet-date').value
    const textInput = document.getElementById('meet-input').value.trim()
    const note = document.getElementById('meet-note').value.trim()
    const payload = textInput || dateInput

    if (!payload) return

    // 客户端预解析和去重
    const parsedDates = parseInputToDates(payload)
    if (parsedDates.length === 0) {
      showToast('未解析到有效的日期', 'error')
      return
    }

    const existingDates = new Set(appState.meetings.map(m => m.date))
    const newDates = parsedDates.filter(d => !existingDates.has(d))
    const duplicateDates = parsedDates.filter(d => existingDates.has(d))

    if (newDates.length === 0) {
      showToast(`所填日期均已存在，未添加：\n${duplicateDates.join(', ')}`, 'info')
      return
    }

    if (duplicateDates.length) {
      showToast(`下列日期已存在，将被跳过：\n${duplicateDates.join(', ')}`, 'info')
    }

    try {
      const result = await meetingsAPI.create(newDates.join(','), note)
      const inserted = (result?.inserted || []).map(i => i.date)
      const skipped = result?.skipped || []

      if (inserted.length) showToast(`已添加：${inserted.join(', ')}`, 'info')
      if (skipped.length) showToast(`已存在（跳过）：${skipped.join(', ')}`, 'info')

      form.reset()
      await render(true)

      // 高亮并滚动到第一个新增记录
      if (inserted.length) {
        const firstDate = inserted[0]
        const el = document.querySelector(`.calendar-day[data-date="${firstDate}"]`)
        if (el) {
          el.classList.add('highlight')
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          setTimeout(() => el.classList.remove('highlight'), 2200)
        }
      }
    } catch (err) {
      if (String(err).includes('unauthorized')) {
        showLogin()
      } else {
        showToast('添加失败', 'error')
        console.error(err)
      }
    }
  })

  // 庆祝按钮
  celebrateBtn.addEventListener('click', () => {
    burstHearts(HEART_BURST_COUNT)
  })

  // 设置初次见面
  setFirstBtn.addEventListener('click', async () => {
    const input = prompt('请输入第一次见面时间（YYYY-MM-DD）:')
    if (!input) return

    try {
      await settingsAPI.setFirstMeeting(input)
      alert('设置成功')
      await render(true)
    } catch (err) {
      if (String(err).includes('unauthorized')) {
        showLogin()
      } else {
        alert('设置失败')
      }
    }
  })

  // 修改密码
  changePassBtn.addEventListener('click', async () => {
    const newPassword = prompt('请输入新密码:')
    if (!newPassword) return

    try {
      await settingsAPI.changePassword(newPassword)
      alert('密码已修改')
    } catch (err) {
      if (String(err).includes('unauthorized')) {
        showLogin()
      } else {
        alert('修改失败')
      }
    }
  })

  // 登出
  logoutBtn.addEventListener('click', async () => {
    try {
      await authAPI.logout()
    } catch (e) {
      console.error('登出失败:', e)
    }
    showLogin()
  })

  // 全局事件监听
  document.addEventListener('meetings:changed', () => render(true))
  
  document.addEventListener('calendar:change', (evt) => {
    const { year, month } = evt.detail
    appState.calYear = year
    appState.calMonth = month
    render(false) // 不重新加载数据，仅重新渲染日历
  })

  // 窗口大小变化时重新定位心形
  window.addEventListener('resize', () => {
    setTimeout(positionHeartToCount, 100)
  })
}

// 应用入口
document.addEventListener('DOMContentLoaded', () => {
  createApp().catch(err => {
    console.error('应用启动失败:', err)
    showLogin()
  })
})