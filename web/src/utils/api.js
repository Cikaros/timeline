// src/utils/api.js
import { API_ROOT } from './constants.js'

/**
 * 统一API请求封装
 * @param {string} path - API路径
 * @param {object} opts - fetch选项
 * @returns {Promise<Response>}
 */
async function apiFetch(path, opts = {}) {
  const headers = Object.assign(
    { 'Content-Type': 'application/json' },
    opts.headers || {}
  )
  
  const options = Object.assign({}, opts, {
    headers,
    credentials: 'include'
  })

  const response = await fetch(`${API_ROOT}${path}`, options)
  
  if (response.status === 401) {
    throw new Error('unauthorized')
  }
  
  if (!response.ok) {
    throw new Error(`请求失败: ${response.status}`)
  }

  return response
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
  
  delete: (id) => apiFetch(`/api/meetings/${id}`, { method: 'DELETE' }),
  
  updateNote: (id, note) => 
    apiFetch(`/api/meetings/${id}`, {
      method: 'POST',
      body: JSON.stringify({ note })
    })
}

// 设置相关API
export const settingsAPI = {
  get: () => apiFetch('/api/settings').then(res => res.json()),
  
  setFirstMeeting: (date) => 
    apiFetch('/api/first-meeting', {
      method: 'POST',
      body: JSON.stringify({ date })
    }),
  
  changePassword: (newPassword) => 
    apiFetch('/api/password', {
      method: 'POST',
      body: JSON.stringify({ newPassword })
    })
}

// 认证相关API
export const authAPI = {
  login: (password) => 
    fetch(`${API_ROOT}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
      credentials: 'include'
    }),
  
  logout: () => apiFetch('/api/logout', { method: 'POST' })
}