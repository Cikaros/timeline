import { describe, expect, test } from 'bun:test'
import {
  LOGIN_LOCKOUT_MS,
  clearLoginAttempts,
  isLoginRateLimited,
  recordFailedLogin
} from './rate-limit.js'

describe('login rate limiting', () => {
  test('locks after the maximum number of failures', () => {
    const key = 'test-lock'
    clearLoginAttempts(key)

    for (let i = 0; i < 4; i++) recordFailedLogin(key, 1000)
    expect(isLoginRateLimited(key, 1000)).toBeFalse()

    recordFailedLogin(key, 1000)
    expect(isLoginRateLimited(key, 1000)).toBeTrue()
    clearLoginAttempts(key)
  })

  test('unlocks after the lockout expires', () => {
    const key = 'test-expiry'
    clearLoginAttempts(key)

    for (let i = 0; i < 5; i++) recordFailedLogin(key, 2000)
    const afterLockout = 2000 + LOGIN_LOCKOUT_MS + 1
    expect(isLoginRateLimited(key, afterLockout)).toBeFalse()
    clearLoginAttempts(key)
  })

  test('clearing attempts resets the limiter', () => {
    const key = 'test-clear'
    clearLoginAttempts(key)
    for (let i = 0; i < 5; i++) recordFailedLogin(key, 3000)
    clearLoginAttempts(key)
    expect(isLoginRateLimited(key, 3000)).toBeFalse()
  })
})
