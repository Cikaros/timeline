import { API_ROOT } from './constants.js'

const REQUEST_TIMEOUT = 10000

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

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
      throw new ApiError('unauthorized', 401)
    }

    if (!response.ok) {
      let message = `请求失败: ${response.status}`
      try {
        const body = await response.clone().json()
        if (body?.error) message = body.error
      } catch (e) {
        // Keep the generic status message when the body is not JSON.
      }
      throw new ApiError(message, response.status)
    }

    return response
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new ApiError('请求超时，请稍后重试', 408)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

export const meetingsAPI = {
  async getAll(pageSize = 1000) {
    const rows = []
    let offset = 0
    let total = 0

    while (true) {
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String(offset)
      })
      const response = await apiFetch(`/api/meetings?${params}`)
      const data = await response.json()
      const pageRows = data.rows || []

      rows.push(...pageRows)
      total = data.total || 0

      if (rows.length >= total || pageRows.length < pageSize) break
      offset += pageSize
    }

    return { rows, total }
  },

  async create(input, note) {
    const response = await apiFetch('/api/meetings', {
      method: 'POST',
      body: JSON.stringify({ input, note })
    })
    return response.json()
  },

  async updateNote(id, note) {
    const response = await apiFetch(`/api/meetings/${id}`, {
      method: 'POST',
      body: JSON.stringify({ note })
    })
    return response.json()
  },

  async delete(id) {
    const response = await apiFetch(`/api/meetings/${id}`, { method: 'DELETE' })
    if (response.status === 204) return { ok: true }
    return response.json()
  }
}

export const settingsAPI = {
  async get() {
    const response = await apiFetch('/api/settings')
    return response.json()
  },

  async setFirstMeeting(date) {
    const response = await apiFetch('/api/first-meeting', {
      method: 'POST',
      body: JSON.stringify({ date })
    })
    return response.json()
  },

  async changePassword(oldPassword, newPassword) {
    const response = await apiFetch('/api/accounts/password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword: oldPassword, newPassword })
    })
    return response.json()
  }
}

export const accountsAPI = {
  async getAll() {
    const response = await apiFetch('/api/accounts')
    return response.json()
  },

  create(username, password) {
    return apiFetch('/api/accounts', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    })
  },

  async delete(id) {
    const response = await apiFetch(`/api/accounts/${id}`, {
      method: 'DELETE'
    })
    return response.json()
  }
}

export const subscriptionsAPI = {
  async getAll() {
    const response = await apiFetch('/api/calendar-subscriptions')
    return response.json()
  },

  create(name) {
    return apiFetch('/api/calendar-subscriptions', {
      method: 'POST',
      body: JSON.stringify(name ? { name } : {})
    })
  },

  update(id, updates) {
    return apiFetch(`/api/calendar-subscriptions/${id}`, {
      method: 'POST',
      body: JSON.stringify(updates)
    })
  },

  async delete(id) {
    const response = await apiFetch(`/api/calendar-subscriptions/${id}`, {
      method: 'DELETE'
    })
    if (response.status === 204) return { ok: true }
    return response.json()
  }
}

export const authAPI = {
  login: (username, password) =>
    apiFetch('/api/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
      skipAuthCheck: true
    }),

  logout: () => apiFetch('/api/logout', { method: 'POST' })
}
