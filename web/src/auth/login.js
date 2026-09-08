// src/auth/login.js
import { authAPI } from '../utils/api.js'
import { showToast } from '../utils/ui.js'

/**
 * 显示登录界面
 * @param {function} onSuccess - 登录成功后的回调
 */
export function showLogin(onSuccess) {
  const root = document.getElementById('app')
  root.innerHTML = `
    <div class="card" style="max-width:420px; margin:48px auto;">
      <div style="text-align:center;padding:18px">
        <div style="font-size:20px;font-weight:700;color:var(--accent)">请先登录</div>
        <div class="muted" style="margin-top:6px">请输入用户名和密码</div>
      </div>
      <div style="padding:12px">
        <input id="login-user" type="text" autocomplete="username" value="owner" placeholder="用户名" style="width:100%;padding:10px;border-radius:8px;border:1px solid rgba(0,0,0,0.08)" />
        <input id="login-pass" type="password" autocomplete="current-password" placeholder="密码" style="width:100%;padding:10px;border-radius:8px;border:1px solid rgba(0,0,0,0.08);margin-top:10px" />
        <div style="display:flex;gap:8px;margin-top:12px">
          <button class="btn" id="login-btn">登录</button>
        </div>
      </div>
    </div>
  `

  const passEl = document.getElementById('login-pass')
  const userEl = document.getElementById('login-user')
  const loginBtn = document.getElementById('login-btn')

  const handleLogin = async () => {
    const username = userEl.value.trim()
    const password = passEl.value.trim()
    if (!username || !password || loginBtn.disabled) return

    loginBtn.disabled = true
    loginBtn.textContent = '登录中...'
    try {
      const response = await authAPI['login'](username, password)
      if (response.ok) {
        onSuccess()
      } else {
        showToast('用户名或密码错误', 'error')
      }
    } catch (err) {
      showToast(err.message || '登录出错', 'error')
    } finally {
      loginBtn.disabled = false
      loginBtn.textContent = '登录'
    }
  }

  loginBtn.addEventListener('click', handleLogin)
  userEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') passEl.focus()
  })
  passEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleLogin()
  })
}
