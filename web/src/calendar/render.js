// src/calendar/render.js
import { getState } from '../state.js'
import { CALENDAR_DEBOUNCE } from '../utils/constants.js'

/**
 * 渲染日历
 * @param {function} onDateClick - 日期点击回调
 * @param {AbortSignal} [signal] - 用于清理事件监听器
 */
export function renderCalendar(onDateClick, signal) {
  const calendarEl = document.getElementById('calendar-view')
  if (!calendarEl) return

  const appState = getState()
  calendarEl.innerHTML = ''

  // 构建日期-会议映射
  const meetingMap = new Map(
    appState.meetings.map(m => [m.date.split('T')[0], m])
  )
  const dateSet = new Set(meetingMap.keys())

  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const firstDayUtc = new Date(Date.UTC(appState.calYear, appState.calMonth, 1))
  const daysInMonth = new Date(Date.UTC(appState.calYear, appState.calMonth + 1, 0)).getUTCDate()
  // getUTCDay: 0=Sunday -> 7, 保持表头“一~日”的周一开头顺序
  const startWeek = firstDayUtc.getUTCDay() || 7

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

  // 回到今天快捷按钮
  const isTodayMonth = appState.calYear === nowYear && appState.calMonth === nowMonth
  const todayBtn = document.createElement('button')
  todayBtn.type = 'button'
  todayBtn.className = 'btn ghost'
  todayBtn.textContent = '今天'
  todayBtn.disabled = isTodayMonth
  todayBtn.title = isTodayMonth ? '当前即本月' : '回到今天'
  todayBtn.addEventListener('click', () => {
    dispatchCalendarChange(nowYear, nowMonth)
  }, { signal })
  header.appendChild(todayBtn)

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

    if (dateStr === todayStr) td.classList.add('today')

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
  }, { signal })

  // 年份/月份切换
  yearSel.addEventListener('change', () => {
    const newYear = Number(yearSel.value)
    buildMonthOptions(newYear)
    const newMonth = Number(monthSel.value)
    dispatchCalendarChange(newYear, newMonth)
  }, { signal })

  monthSel.addEventListener('change', () => {
    const newYear = Number(yearSel.value)
    const newMonth = Number(monthSel.value)
    dispatchCalendarChange(newYear, newMonth)
  }, { signal })

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
    }, { passive: true, signal })

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
    }, { passive: true, signal })
  }
}
