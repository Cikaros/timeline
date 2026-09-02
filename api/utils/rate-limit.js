const attempts = new Map()

export const LOGIN_MAX_ATTEMPTS = 5
export const LOGIN_WINDOW_MS = 15 * 60 * 1000
export const LOGIN_LOCKOUT_MS = 15 * 60 * 1000

export function isLoginRateLimited(key, now = Date.now()) {
  const state = attempts.get(key)
  if (!state) return false

  if (state.lockedUntil > now) return true
  if (state.lockedUntil && state.lockedUntil <= now) {
    attempts.delete(key)
    return false
  }
  return false
}

export function recordFailedLogin(key, now = Date.now()) {
  let state = attempts.get(key)
  if (!state) {
    state = { count: 0, firstAttemptAt: now, lockedUntil: 0 }
    attempts.set(key, state)
  }

  if (state.lockedUntil > now) return state
  if (now - state.firstAttemptAt >= LOGIN_WINDOW_MS) {
    state.count = 0
    state.firstAttemptAt = now
  }

  state.count += 1
  if (state.count >= LOGIN_MAX_ATTEMPTS) {
    state.lockedUntil = now + LOGIN_LOCKOUT_MS
  }
  return state
}

export function clearLoginAttempts(key) {
  attempts.delete(key)
}
