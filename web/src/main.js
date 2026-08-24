// src/main.js — 应用入口
import { parseInputToDates, formatDateObj } from './utils/dateParser.js'
import { meetingsAPI, settingsAPI, authAPI } from './utils/api.js'
import { showToast } from './utils/ui.js'
import { HEART_POSITION_DELAY } from './utils/constants.js'
import { getState, setState } from './state.js'
import { showLogin } from './auth/login.js'
import { renderCalendar } from './calendar/render.js'
import { positionHeartToCount, burstHearts } from './animations/heart.js'
import { showNotePopup } from './components/note-popup.js'
import { showPrompt, showMultiPrompt, showAlert } from './components/prompt-modal.js'

/**
 * 计算两个日期之间的天数
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
 * 渲染应用
 */
async function render(reload = true) {
  try {
    if (reload) {
      // 加载会议数据
      const meetingsData = await meetingsAPI.getAll()
      const meetings = (meetingsData.rows || []).map(m => ({
        ...m,
        date: m.date.split('T')[0]
      })).sort((a, b) => new Date(b.date) - new Date(a.date))

      // 加载设置（首次见面日期）
      let firstMeetingDate = null
      try {
        const settings = await settingsAPI.get()
        firstMeetingDate = settings.first_meeting
      } catch (e) {
        // 如果没有设置，从最早的会议记录推断
        if (meetings.length) {
          const sortedDates = meetings
            .map(m => new Date(Date.UTC(...m.date.split('-').map(Number))))
            .sort((a, b) => a - b)
          firstMeetingDate = formatDateObj(sortedDates[0])
        }
      }

      const firstMeetingYear = firstMeetingDate ? Number(firstMeetingDate.split('-')[0]) : null
      const updates = { meetings, total: meetingsData.total || 0, firstMeetingDate, firstMeetingYear }

      // 确保日历不会显示早于首次见面的年份
      if (firstMeetingYear && getState().calYear < firstMeetingYear) {
        updates.calYear = firstMeetingYear
      }

      setState(updates)
    }

    const state = getState()

    // 渲染日历（传递 signal 以便清理事件监听器）
    renderCalendar((dateStr) => {
      const currentState = getState()
      const meeting = currentState.meetings.find(m => m.date === dateStr)
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
    }, abortController?.signal)

    // 更新统计数据
    document.getElementById('total-count').textContent = state.total

    if (state.firstMeetingDate) {
      const days = Math.max(0, daysBetween(state.firstMeetingDate, new Date()))
      document.getElementById('days-counter').textContent = `${days} 天`
    } else {
      document.getElementById('days-counter').textContent = '0 天'
    }

    // 延迟定位心形（等待布局完成）
    setTimeout(positionHeartToCount, HEART_POSITION_DELAY)
  } catch (e) {
    if (String(e).includes('unauthorized')) {
      showLogin(() => createApp())
    } else {
      console.error('渲染失败:', e)
      showToast('加载数据失败', 'error')
    }
  }
}

// 事件监听器管理
let abortController = null

/**
 * 创建应用主界面
 */
async function createApp() {
  const root = document.getElementById('app')

  // 验证登录状态
  try {
    await settingsAPI.get()
  } catch (e) {
    return showLogin(() => createApp())
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

  // 清理旧的事件监听器，防止重复绑定
  if (abortController) abortController.abort()
  abortController = new AbortController()
  const { signal } = abortController

  // 绑定事件
  bindEvents(signal)

  // 初始渲染
  await render()
}

/**
 * 绑定所有事件监听
 */
function bindEvents(signal) {
  const form = document.getElementById('meet-form')
  const celebrateBtn = document.getElementById('celebrate')
  const setFirstBtn = document.getElementById('set-first')
  const changePassBtn = document.getElementById('change-pass')
  const logoutBtn = document.getElementById('logout')

  // 表单提交
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const appState = getState()
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
        showLogin(() => createApp())
      } else {
        showToast('添加失败', 'error')
        console.error(err)
      }
    }
  })

  // 庆祝按钮
  celebrateBtn.addEventListener('click', () => {
    burstHearts()
  })

  // 设置初次见面
  setFirstBtn.addEventListener('click', async () => {
    const input = await showPrompt({
      title: '设置初次见面日期',
      placeholder: 'YYYY-MM-DD',
      inputType: 'date'
    })
    if (!input) return

    try {
      await settingsAPI.setFirstMeeting(input)
      await showAlert('设置成功')
      await render(true)
    } catch (err) {
      if (String(err).includes('unauthorized')) {
        showLogin(() => createApp())
      } else {
        await showAlert('设置失败')
      }
    }
  })

  // 修改密码
  changePassBtn.addEventListener('click', async () => {
    const values = await showMultiPrompt({
      title: '修改密码',
      fields: [
        { label: '当前密码', type: 'password', placeholder: '请输入当前密码' },
        { label: '新密码', type: 'password', placeholder: '至少6个字符' }
      ]
    })
    if (!values) return
    const [oldPassword, newPassword] = values
    if (!oldPassword || !newPassword) return

    try {
      await settingsAPI.changePassword(oldPassword, newPassword)
      showToast('密码已修改')
      await render(true)
    } catch (err) {
      if (String(err).includes('unauthorized')) {
        showLogin(() => createApp())
      } else {
        showToast('修改失败：' + (err.message || '请检查当前密码是否正确'), 'error')
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
    showLogin(() => createApp())
  })

  // 全局事件监听（使用 AbortController signal 防止累积）
  document.addEventListener('meetings:changed', () => render(true), { signal })

  document.addEventListener('calendar:change', (evt) => {
    const { year, month } = evt.detail
    setState({ calYear: year, calMonth: month })
    render(false) // 不重新加载数据，仅重新渲染日历
  }, { signal })

  window.addEventListener('resize', () => {
    setTimeout(positionHeartToCount, 100)
  }, { signal })
}

// 应用入口
document.addEventListener('DOMContentLoaded', () => {
  createApp().catch(err => {
    console.error('应用启动失败:', err)
    showLogin(() => createApp())
  })
})
