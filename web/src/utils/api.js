// src/utils/api.js
import { API_ROOT } from './constants.js'

const REQUEST_TIMEOUT = 10000

/**
 * 统一API请求封装
 * @param {string} path - API路径
 * @param {object} opts - fetch选项
 * @returns {Promise<Response>}
 */
async function apiFetch(path, opts = {}) {
  const { skipAuthCheck, ...fetchOpts } = opts
  const headers = Object.assign(
    { 'Content-Type': 'application/json' },
    fetchOpts.headers || {}
  )

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

  const options = Object.assign({}, fetchOpts, {
    headers,
    credentials: 'include',
    signal: controller.signal
  })

  try {
    const response = await fetch(`${API_ROOT}${path}`, options)

    if (response.status === 401 && !skipAuthCheck) {
      throw new Error('unauthorized')
    }

    if (!response.ok) {
      throw new Error(`请求失败: ${response.status}`)
    }

    return response
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('请求超时，请稍后重试')
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

// 会议相关API
export const meetingsAPI = {
  getAll: (limit = 1000, offset = 0) =>
    apiFetch(`/api/meetings?limit=${limit}&offset=${offset}`).then(res => res.json()),

  create: (input, note) =>
    apiFetch('/api/meetings', {
      method: 'POST',
      body: JSON.stringify({ input, note })
    }).then(res => res.json()),

  updateNote: (id, note) =>
    apiFetch(`/api/meetings/${id}`, {
      method: 'POST',
      body: JSON.stringify({ note })
    }).then(res => res.json()),

  delete: (id) =>
    apiFetch(`/api/meetings/${id}`, { method: 'DELETE' }).then(res => {
      // 204 No Content has no body
      if (res.status === 204) return { ok: true }
      return res.json()
    })
}

// 设置相关API
export const settingsAPI = {
  get: () => apiFetch('/api/settings').then(res => res.json()),
  
  setFirstMeeting: (date) =>
    apiFetch('/api/first-meeting', {
      method: 'POST',
      body: JSON.stringify({ date })
    }).then(res => res.json()),

  changePassword: (oldPassword, newPassword) =>
    apiFetch('/api/password', {
      method: 'POST',
      body: JSON.stringify({ oldPassword, newPassword })
    }).then(res => res.json())
}

// 认证相关API
export const authAPI = {
  login: (password) =>
    apiFetch('/api/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
      skipAuthCheck: true
    }),

  logout: () => apiFetch('/api/logout', { method: 'POST' })
}