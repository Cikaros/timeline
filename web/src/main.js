// src/main.js — 应用入口
import { parseInputToDates, formatDateObj } from './utils/dateParser.js'
import {
  meetingsAPI,
  settingsAPI,
  authAPI,
  subscriptionsAPI,
  accountsAPI
} from './utils/api.js'
import { showToast } from './utils/ui.js'
import { getState, setState } from './state.js'
import { showLogin } from './auth/login.js'
import { renderCalendar } from './calendar/render.js'
import { positionHeartToCount, burstHearts } from './animations/heart.js'
import { showNotePopup } from './components/note-popup.js'
import { showPrompt, showMultiPrompt, showConfirm, showAlert } from './components/prompt-modal.js'

/**
 * 计算两个日期之间的天数
 */
function daysBetween(a, b) {
  function toUTCTimestamp(x) {
    if (typeof x === 'string') {
      const [y, mo, da] = x.split('T')[0].split('-').map(Number)
      return Date.UTC(y, (mo || 1) - 1, da || 1)
    }
    return Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate())
  }

  const ONE_DAY = 24 * 60 * 60 * 1000
  return Math.floor((toUTCTimestamp(b) - toUTCTimestamp(a)) / ONE_DAY)
}

/**
 * 渲染应用
 */
async function render(reload = true, preloadedSettings = null) {
  try {
    if (reload) {
      const [meetingsData, settings, subscriptionsData, accountsData] = await Promise.all([
        meetingsAPI.getAll(),
        preloadedSettings ?? settingsAPI.get(),
        subscriptionsAPI.getAll(),
        accountsAPI.getAll()
      ])

      const meetings = (meetingsData.rows || []).map(m => ({
        ...m,
        category: m.category || 'meetings',
        date: m.date.split('T')[0]
      })).sort((a, b) => b.date.localeCompare(a.date))

      let firstMeetingDate = settings.first_meeting
      if (!firstMeetingDate && meetings.length) {
        firstMeetingDate = meetings.reduce(
          (min, m) => (m.date < min ? m.date : min),
          meetings[0].date
        )
      }

      const firstMeetingYear = firstMeetingDate ? Number(firstMeetingDate.split('-')[0]) : null
      const updates = {
        meetings,
        total: meetingsData.total || 0,
        firstMeetingDate,
        firstMeetingYear,
        subscriptions: subscriptionsData.subscriptions || [],
        accounts: accountsData.accounts || [],
        maxAccounts: accountsData.maxAccounts || 2,
        currentUser: settings.current_user || null
      }

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
        async ({ note, category }) => {
          try {
            if (meeting) {
              await meetingsAPI.updateNote(meeting.id, note, category)
              showToast('记录已保存')
            } else if (note) {
              await meetingsAPI.create(dateStr, note, category)
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
    renderAccounts()
    renderSubscriptions()

    if (state.firstMeetingDate) {
      const days = Math.max(0, daysBetween(state.firstMeetingDate, new Date()))
      document.getElementById('days-counter').textContent = `${days} 天`
    } else {
      document.getElementById('days-counter').textContent = '0 天'
    }

    requestAnimationFrame(positionHeartToCount)
  } catch (e) {
    if (e?.status === 401) {
      showLogin(() => createApp())
    } else {
      console.error('渲染失败:', e)
      showToast('加载数据失败', 'error')
    }
  }
}

function getSubscriptionUrl(subscription) {
  return `${window.location.origin}/api/calendar/${subscription.token}.ics`
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function formatSubscriptionTime(timestamp) {
  if (!timestamp) return '从未访问'
  const date = new Date(timestamp)
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(
    date.getUTCDate()
  ).padStart(2, '0')} ${String(date.getUTCHours()).padStart(2, '0')}:${String(
    date.getUTCMinutes()
  ).padStart(2, '0')}`
}

function renderSubscriptions() {
  const container = document.getElementById('subscription-list')
  if (!container) return

  const subscriptions = getState().subscriptions
  if (!subscriptions.length) {
    container.innerHTML = '<div class="subscription-empty">还没有订阅链接</div>'
    return
  }

  container.innerHTML = subscriptions.map(subscription => `
    <div class="subscription-item">
      <div class="subscription-info">
        <div class="subscription-name">${escapeHtml(subscription.name)}</div>
        <div class="subscription-meta muted">
          ${subscription.enabled ? '已启用' : '已停用'} · 访问 ${subscription.access_count} 次 · 最近 ${formatSubscriptionTime(subscription.last_accessed_at)}
        </div>
      </div>
      <div class="subscription-actions">
        <button class="btn ghost" type="button" data-action="copy" data-id="${subscription.id}">复制链接</button>
        <button class="btn ghost" type="button" data-action="rename" data-id="${subscription.id}">重命名</button>
        <button class="btn ghost" type="button" data-action="toggle" data-id="${subscription.id}">${subscription.enabled ? '停用' : '启用'}</button>
        <button class="btn ghost danger" type="button" data-action="delete" data-id="${subscription.id}">删除</button>
      </div>
    </div>
  `).join('')
}

function formatAccountTime(timestamp) {
  const date = new Date(timestamp)
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(
    date.getUTCDate()
  ).padStart(2, '0')}`
}

function renderAccounts() {
  const container = document.querySelector('.account-modal-list')
  if (!container) return

  const state = getState()
  const accounts = state.accounts
  const createButton = document.getElementById('account-modal-create')
  if (createButton) {
    createButton.disabled = accounts.length >= state.maxAccounts
  }

  if (!accounts.length) {
    container.innerHTML = '<div class="subscription-empty">暂无账号</div>'
    return
  }

  container.innerHTML = accounts.map(account => {
    const isCurrent = state.currentUser?.id === account.id
    const isAdmin = account.role === 'admin'
    return `
      <div class="subscription-item${isCurrent ? ' current' : ''}">
        <div class="subscription-info">
          <div class="subscription-name">
            ${escapeHtml(account.username)}
            ${isAdmin ? '<span class="role-badge">管理员</span>' : ''}
          </div>
          <div class="subscription-meta muted">
            ${isCurrent ? '当前账号 · ' : ''}创建于 ${formatAccountTime(account.created_at)}
          </div>
        </div>
        <div class="subscription-actions">
          ${isCurrent ? '<button class="btn ghost" type="button" data-action="password" data-id="' + account.id + '">修改密码</button>' : ''}
          ${isAdmin ? '' : `<button class="btn ghost danger" type="button" data-action="delete" data-id="${account.id}">删除</button>`}
        </div>
      </div>
    `
  }).join('')
}

async function reloadAccounts() {
  const data = await accountsAPI.getAll()
  setState({ accounts: data.accounts || [], maxAccounts: data.maxAccounts || 2 })
  renderAccounts()
}

function closeAccountModal() {
  document.querySelector('.account-modal-overlay')?.remove()
}

function closeCalendarHelpModal() {
  document.querySelector('.calendar-help-modal-overlay')?.remove()
}

function openCalendarHelpModal(signal) {
  closeCalendarHelpModal()

  const origin = window.location.origin
  const caldavUrl = `${origin}/caldav/`
  const username = getState().currentUser?.username || 'owner'
  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay calendar-help-modal-overlay'
  overlay.innerHTML = `
    <div class="modal-inner help-modal-inner" role="dialog" aria-modal="true" aria-labelledby="calendar-help-title">
      <div class="account-modal-header">
        <div>
          <div class="modal-title" id="calendar-help-title">日历同步说明</div>
          <div class="subscription-warning">请在要添加日历的设备上访问当前地址后再复制</div>
        </div>
        <button class="btn ghost" id="calendar-help-close" type="button">关闭</button>
      </div>

      <section class="help-section">
        <div class="help-section-title">只读订阅（ICS）</div>
        <ol class="help-list">
          <li>点击“获取新链接”创建订阅链接。</li>
          <li>点击“复制链接”，把完整 ICS 地址粘贴到手机日历。</li>
          <li>iOS：设置 → 日历 → 账户 → 添加账户 → 其他 → 添加订阅日历。</li>
          <li>Android：在系统日历中选择“添加订阅日历”或“从 URL 添加”。</li>
        </ol>
      </section>

      <section class="help-section">
        <div class="help-section-title">双向同步（CalDAV）</div>
        <div class="help-address-row">
          <code class="help-address" id="caldav-address">${escapeHtml(caldavUrl)}</code>
          <button class="btn ghost" type="button" data-copy-caldav>复制</button>
        </div>
        <p class="help-note">macOS 自带日历不允许 HTTP + Basic 认证，必须使用 HTTPS。自动发现入口是 <code>/.well-known/caldav/</code>；手动填写时优先使用下方服务器路径。</p>
        <ol class="help-list">
          <li>macOS：日历 → 设置 → 账户 → 添加其他日历账户 → CalDAV 账户。</li>
          <li>iOS：设置 → 日历 → 账户 → 添加账户 → 其他 → 添加 CalDAV 账户。</li>
          <li>Android：在支持 CalDAV 的日历应用或同步工具中添加账户。</li>
          <li>保存后同步 Timeline 与手机日历；支持新增、修改、删除全天事件。</li>
        </ol>
        <dl class="help-fields">
          <div>
            <dt>用户名</dt>
            <dd>填 Timeline 登录名，当前是 <strong>${escapeHtml(username)}</strong>；不要填邮箱。</dd>
          </div>
          <div>
            <dt>密码</dt>
            <dd>填这个 Timeline 账号的密码；不是 Mac 或 iCloud 密码。</dd>
          </div>
          <div>
            <dt>服务器地址</dt>
            <dd>只填主机名或 IP，例如 <code>localhost</code>、<code>192.168.1.20</code> 或 <code>timeline.example.com</code>；不要加 <code>http://</code>、端口或路径。</dd>
          </div>
          <div>
            <dt>服务器路径</dt>
            <dd>填 <code>/caldav/</code>，保留结尾斜杠。</dd>
          </div>
          <div>
            <dt>端口</dt>
            <dd>按当前地址填：本地 macOS 同步使用 HTTPS 开发服务 <code>5174</code>；生产环境 HTTPS 通常 <code>443</code>；自部署时使用实际暴露的端口。</dd>
          </div>
          <div>
            <dt>使用 SSL</dt>
            <dd>macOS 自带日历必须开启。当前页面是 <code>https://</code> 才能验证账户；本地开发使用 <code>https://localhost:5174</code>。</dd>
          </div>
          <div>
            <dt>使用 Kerberos v5 进行认证</dt>
            <dd>关闭。Timeline 使用 HTTP Basic 认证，不支持 Kerberos。</dd>
          </div>
        </dl>
        <p class="help-note">Timeline 仅映射全天事件；多日事件会拆成多天记录，重复规则暂不支持。</p>
      </section>
    </div>
  `
  document.body.appendChild(overlay)

  const close = () => closeCalendarHelpModal()
  overlay.querySelector('#calendar-help-close').addEventListener('click', close)
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close()
  })
  overlay.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-copy-caldav]')
    if (!button) return
    try {
      await navigator.clipboard.writeText(caldavUrl)
      showToast('CalDAV 地址已复制')
    } catch (e) {
      await showPrompt({
        title: '请手动复制 CalDAV 地址',
        defaultValue: caldavUrl,
        confirmText: '关闭'
      })
    }
  })
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close()
  }, { signal })
}

function openAccountModal(signal) {
  closeAccountModal()

  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay account-modal-overlay'
  overlay.innerHTML = `
    <div class="modal-inner account-modal-inner" role="dialog" aria-modal="true" aria-labelledby="account-modal-title">
      <div class="account-modal-header">
        <div>
          <div class="modal-title" id="account-modal-title">账号管理</div>
          <div class="subscription-warning">
            全局最多 2 个账号；删除账号不会删除见面记录
          </div>
        </div>
        <button class="btn ghost" id="account-modal-close" type="button">关闭</button>
      </div>
      <div class="account-modal-list" id="account-modal-list"></div>
      <div class="account-modal-footer">
        <button class="btn" id="account-modal-create" type="button">新增账号</button>
      </div>
    </div>
  `
  document.body.appendChild(overlay)

  const close = () => closeAccountModal()
  overlay.querySelector('#account-modal-close').addEventListener('click', close)
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close()
  })
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close()
  }, { signal })

  overlay.querySelector('#account-modal-create').addEventListener('click', async (event) => {
    const createButton = event.currentTarget
    const values = await showMultiPrompt({
      title: '新增账号',
      fields: [
        { label: '用户名', type: 'text', placeholder: '2-32个字符' },
        { label: '密码', type: 'password', placeholder: '至少6个字符' },
        { label: '确认密码', type: 'password', placeholder: '再次输入新密码' }
      ]
    })
    if (!values) return

    const [username, password, confirmPassword] = values
    if (!username || !password || password.length < 6) {
      await showAlert('请输入用户名，且密码至少需要6个字符')
      return
    }
    if (password !== confirmPassword) {
      await showAlert('两次输入的密码不一致')
      return
    }

    createButton.disabled = true
    try {
      await accountsAPI.create(username, password)
      await reloadAccounts()
      showToast('账号已创建')
    } catch (err) {
      if (err?.status === 401) {
        close()
        showLogin(() => createApp())
      } else {
        showToast(err.message || '创建失败', 'error')
      }
    } finally {
      createButton.disabled = false
    }
  })

  overlay.querySelector('.account-modal-list').addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]')
    if (!button) return

    const account = getState().accounts.find(
      item => item.id === Number(button.dataset.id)
    )
    if (!account) return
    const action = button.dataset.action

    if (action === 'password') {
      const values = await showMultiPrompt({
        title: `修改 ${account.username} 的密码`,
        fields: [
          { label: '当前密码', type: 'password', placeholder: '请输入当前密码' },
          { label: '新密码', type: 'password', placeholder: '至少6个字符' },
          { label: '确认新密码', type: 'password', placeholder: '再次输入新密码' }
        ]
      })
      if (!values) return

      const [currentPassword, newPassword, confirmPassword] = values
      if (!currentPassword || !newPassword || newPassword.length < 6) {
        await showAlert('请输入当前密码，且新密码至少需要6个字符')
        return
      }
      if (newPassword !== confirmPassword) {
        await showAlert('两次输入的新密码不一致')
        return
      }

      try {
        await settingsAPI.changePassword(currentPassword, newPassword)
        closeAccountModal()
        showToast('密码已修改')
        await render(true)
      } catch (err) {
        if (err?.status === 401) {
          close()
          showLogin(() => createApp())
        } else {
          await showAlert(err.message || '修改失败')
        }
      }
      return
    }

    if (action === 'delete') {
      const confirmed = await showConfirm(
        `确定删除账号「${account.username}」吗？账号的订阅链接会一起删除，见面记录会保留。`,
        '删除账号'
      )
      if (!confirmed) return

      try {
        const result = await accountsAPI.delete(account.id)
        if (result.deletedSelf) {
          close()
          showLogin(() => createApp())
          return
        }
        await reloadAccounts()
        showToast('账号已删除')
      } catch (err) {
        if (err?.status === 401) {
          close()
          showLogin(() => createApp())
        } else {
          showToast(err.message || '删除失败', 'error')
        }
      }
    }
  })

  reloadAccounts().catch(err => {
    if (err?.status === 401) {
      close()
      showLogin(() => createApp())
    } else {
      showToast(err.message || '加载账号失败', 'error')
    }
  })
}

async function copySubscriptionUrl(subscription) {
  const url = getSubscriptionUrl(subscription)
  try {
    await navigator.clipboard.writeText(url)
    showToast('订阅链接已复制')
  } catch (e) {
    await showPrompt({
      title: '请手动复制订阅链接',
      defaultValue: url,
      confirmText: '关闭'
    })
  }
}

async function reloadSubscriptions() {
  const data = await subscriptionsAPI.getAll()
  setState({ subscriptions: data.subscriptions || [] })
  renderSubscriptions()
}

// 事件监听器管理
let abortController = null

async function changeRequiredPassword() {
  while (true) {
    const values = await showMultiPrompt({
      title: '请先修改默认密码',
      fields: [
        { label: '当前密码', type: 'password', placeholder: '请输入当前密码' },
        { label: '新密码', type: 'password', placeholder: '至少6个字符' },
        { label: '确认新密码', type: 'password', placeholder: '再次输入新密码' }
      ]
    })

    if (!values) {
      try {
        await authAPI['logout']()
      } catch (e) {
        // The session will expire naturally if logout fails.
      }
      return false
    }

    const [currentPassword, newPassword, confirmPassword] = values
    if (!currentPassword || !newPassword || newPassword.length < 6) {
      await showAlert('请输入当前密码，且新密码至少需要6个字符')
      continue
    }
    if (newPassword !== confirmPassword) {
      await showAlert('两次输入的新密码不一致')
      continue
    }

    try {
      await settingsAPI.changePassword(currentPassword, newPassword)
      showToast('密码已修改')
      return true
    } catch (err) {
      await showAlert(err.message || '修改失败，请重试')
    }
  }
}

/**
 * 创建应用主界面
 */
async function createApp() {
  const root = document.getElementById('app')
  const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)
  const subscriptionWarning = isLocalHost
    ? '手机日历无法访问 localhost，请改用局域网 IP 或公网域名'
    : '请勿将订阅链接转发给无关人员'

  // 验证登录状态，并复用这次设置请求，避免启动时重复请求
  let initialSettings = null
  try {
    initialSettings = await settingsAPI.get()
    if (initialSettings.must_change_password) {
      const changed = await changeRequiredPassword()
      if (!changed) return showLogin(() => createApp())
      initialSettings = await settingsAPI.get()
    }
  } catch (e) {
    if (e?.status === 401) return showLogin(() => createApp())
    showToast('初始化失败', 'error')
    return
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
          <button class="btn ghost admin" id="accounts-entry" aria-haspopup="dialog">账号管理</button>
          <button class="btn ghost" id="change-pass">修改密码</button>
          <button class="btn ghost" id="logout">登出</button>
        </div>

      </div>
    </div>

    <div class="panel subscription-panel">
      <div class="subscription-header">
        <div>
          <div class="subscription-title-row">
            <div class="subscription-title">日历订阅</div>
            <button class="help-button" id="calendar-help" type="button" aria-haspopup="dialog" aria-label="查看日历订阅和 CalDAV 使用说明">?</button>
          </div>
              <div class="subscription-warning">${escapeHtml(subscriptionWarning)}</div>
        </div>
        <button class="btn" id="create-subscription">获取新链接</button>
      </div>
      <div id="subscription-list"></div>
    </div>

    <div class="grid">
      <div class="panel">
        <div class="panel-heading">
          <div class="panel-title">添加记录</div>
        </div>
        <form id="meet-form" data-mode="date">
          <div class="segmented-control" role="group" aria-label="日期输入方式">
            <button type="button" class="segment-button is-active" data-meet-mode="date" aria-pressed="true">选择日期</button>
            <button type="button" class="segment-button" data-meet-mode="bulk" aria-pressed="false">批量日期</button>
          </div>
          <div id="meet-date-field" class="meet-field is-active">
            <label class="field-label" for="meet-date">日期</label>
            <input id="meet-date" type="date" />
          </div>
          <div id="meet-input-field" class="meet-field" hidden>
            <label class="field-label" for="meet-input">日期列表</label>
            <textarea id="meet-input" rows="4" placeholder="20250101、20250105 或 20250101~20250105"></textarea>
          </div>
          <div class="meet-field">
            <label class="field-label" for="meet-category">分类</label>
            <select id="meet-category" class="meet-select">
              <option value="meetings">见面</option>
              <option value="travel">旅行</option>
              <option value="dating">约会</option>
              <option value="anniversary">纪念日</option>
            </select>
          </div>
          <div class="meet-field">
            <label class="field-label" for="meet-note">备注</label>
            <textarea id="meet-note" class="meet-note" rows="2" placeholder="备注（可选）"></textarea>
          </div>
          <div class="controls">
            <button class="btn meet-submit" type="submit">添加</button>
          </div>
        </form>
        <div class="panel-divider"></div>
        <div class="panel-heading">
          <div class="panel-title">历史日历</div>
        </div>
        <div id="calendar-view" class="calendar-view"></div>
      </div>

      <div>
        <div class="panel story-panel" style="text-align:center;position:relative;overflow:visible;height:100%">
          <div style="font-weight:700;color:var(--accent);font-size:18px">我们的故事</div>
          <div style="margin-top:12px;color:var(--muted)">每一次相聚，都是我最想收藏的日子。</div>
          <div class="count-block">
            <div class="count-wrap">
              <div class="muted count-label">总次数</div>
              <div id="total-count" class="count-value">0</div>
            </div>
          </div>
          <div class="story-actions">
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
  await render(true, initialSettings)
}

/**
 * 绑定所有事件监听
 */
function bindEvents(signal) {
  const form = document.getElementById('meet-form')
  const accountsEntryBtn = document.getElementById('accounts-entry')
  const celebrateBtn = document.getElementById('celebrate')
  const setFirstBtn = document.getElementById('set-first')
  const changePassBtn = document.getElementById('change-pass')
  const logoutBtn = document.getElementById('logout')

  const modeButtons = [...form.querySelectorAll('.segment-button')]
  const dateField = document.getElementById('meet-date-field')
  const inputField = document.getElementById('meet-input-field')

  function setMeetMode(mode) {
    const activeMode = mode === 'bulk' ? 'bulk' : 'date'
    form.dataset.mode = activeMode
    dateField.hidden = activeMode !== 'date'
    dateField.classList.toggle('is-active', activeMode === 'date')
    inputField.hidden = activeMode !== 'bulk'
    inputField.classList.toggle('is-active', activeMode === 'bulk')
    modeButtons.forEach(button => {
      const active = button.dataset.meetMode === activeMode
      button.classList.toggle('is-active', active)
      button.setAttribute('aria-pressed', String(active))
    })
  }

  modeButtons.forEach(button => {
    button.addEventListener('click', () => {
      setMeetMode(button.dataset.meetMode)
    }, { signal })
  })

  setMeetMode(form.dataset.mode)

  // 表单提交
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const appState = getState()
    const dateInput = document.getElementById('meet-date').value
    const textInput = document.getElementById('meet-input').value.trim()
    const note = document.getElementById('meet-note').value.trim()
    const mode = form.dataset.mode === 'bulk' ? 'bulk' : 'date'
    const payload = mode === 'bulk' ? textInput : dateInput

    if (!payload) {
      showToast(mode === 'bulk' ? '请输入日期' : '请选择日期', 'info')
      return
    }

    // 客户端预解析和去重
    const parsedDates = parseInputToDates(payload)
    if (parsedDates.length === 0) {
      showToast('未解析到有效的日期', 'error')
      return
    }

    const categoryField = document.getElementById('meet-category')
    const category = categoryField?.value || 'meetings'
    const existingDates = new Set(
      appState.meetings.map(m => `${m.date}:${m.category || 'meetings'}`)
    )
    const newDates = parsedDates.filter(d => !existingDates.has(d))
    const duplicateDates = parsedDates.filter(d => existingDates.has(d))

    if (newDates.length === 0) {
      showToast(`所填日期均已存在，未添加：\n${duplicateDates.join(', ')}`, 'info')
      return
    }

    if (duplicateDates.length) {
      showToast(`下列日期已存在，将被跳过：\n${duplicateDates.join(', ')}`, 'info')
    }

    const submitBtn = form.querySelector('button[type="submit"]')
    const submitText = submitBtn.textContent
    submitBtn.disabled = true
    submitBtn.textContent = '添加中...'
    try {
      const result = await meetingsAPI.create(newDates.join(','), note, category)
      const inserted = new Set((result?.inserted || []).map(i => i.date))
      const skipped = new Set(result?.skipped || [])

      const insertedDates = newDates.filter(d => inserted.has(d))
      const skippedDates = newDates.filter(d => skipped.has(d) || (existingDates.has(`${d}:${category}`) && !inserted.has(d)))
      const missingDates = newDates.filter(d => !inserted.has(d) && !skippedDates.includes(d))

      if (insertedDates.length) showToast(`已添加：${insertedDates.join(', ')}`, 'info')
      if (skippedDates.length) showToast(`已存在（跳过）：${skippedDates.join(', ')}`, 'info')
      if (missingDates.length) showToast(`以下日期未处理：${missingDates.join(', ')}`, 'error')

      if (insertedDates.length || missingDates.length) {
        await render(true)
      }

      if (insertedDates.length) form.reset()

      // 高亮并滚动到第一个新增记录
      if (insertedDates.length) {
        const firstDate = insertedDates[0]
        const el = document.querySelector(`.calendar-day[data-date="${firstDate}"]`)
        if (el) {
          el.classList.add('highlight')
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          setTimeout(() => el.classList.remove('highlight'), 2200)
        }
      }
    } catch (err) {
      if (err?.status === 401) {
        showLogin(() => createApp())
      } else {
        showToast(err.message || '添加失败', 'error')
        console.error(err)
      }
    } finally {
      submitBtn.disabled = false
      submitBtn.textContent = submitText
    }
  })

  // 庆祝按钮
  celebrateBtn.addEventListener('click', () => {
    burstHearts()
  })

  accountsEntryBtn.addEventListener('click', () => {
    openAccountModal(signal)
  }, { signal })

  const calendarHelpButton = document.getElementById('calendar-help')
  calendarHelpButton.addEventListener('click', () => {
    openCalendarHelpModal(signal)
  }, { signal })

  // 日历订阅
  const createSubscriptionBtn = document.getElementById('create-subscription')
  const subscriptionList = document.getElementById('subscription-list')

  createSubscriptionBtn.addEventListener('click', async () => {
    createSubscriptionBtn.disabled = true
    try {
      await subscriptionsAPI.create()
      await reloadSubscriptions()
      showToast('订阅链接已创建')
    } catch (err) {
      if (err?.status === 401) {
        showLogin(() => createApp())
      } else {
        showToast(err.message || '创建失败', 'error')
      }
    } finally {
      createSubscriptionBtn.disabled = false
    }
  }, { signal })

  subscriptionList.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]')
    if (!button) return

    const subscription = getState().subscriptions.find(
      item => item.id === Number(button.dataset.id)
    )
    if (!subscription) return

    try {
      const action = button.dataset.action
      if (action === 'copy') {
        await copySubscriptionUrl(subscription)
        return
      }

      if (action === 'rename') {
        const name = await showPrompt({
          title: '重命名订阅链接',
          defaultValue: subscription.name,
          placeholder: '手机日历'
        })
        if (!name) return
        await subscriptionsAPI.update(subscription.id, { name })
      }

      if (action === 'toggle') {
        await subscriptionsAPI.update(subscription.id, { enabled: !subscription.enabled })
      }

      if (action === 'delete') {
        const confirmed = await showConfirm(
          `确定删除「${subscription.name}」吗？旧链接将立即失效。`,
          '删除订阅'
        )
        if (!confirmed) return
        await subscriptionsAPI.delete(subscription.id)
      }

      await reloadSubscriptions()
    } catch (err) {
      if (err?.status === 401) {
        showLogin(() => createApp())
      } else {
        showToast(err.message || '操作失败', 'error')
      }
    }
  }, { signal })

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
      if (err?.status === 401) {
        showLogin(() => createApp())
      } else {
        await showAlert(err.message || '设置失败')
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
      if (err?.status === 401) {
        showLogin(() => createApp())
      } else {
        showToast(err.message || '修改失败：请检查当前密码是否正确', 'error')
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

  let resizeTimer = null
  window.addEventListener('resize', () => {
    if (resizeTimer) clearTimeout(resizeTimer)
    resizeTimer = setTimeout(positionHeartToCount, 150)
  }, { signal })
}

// 应用入口
document.addEventListener('DOMContentLoaded', () => {
  createApp().catch(err => {
    console.error('应用启动失败:', err)
    showLogin(() => createApp())
  })
})
