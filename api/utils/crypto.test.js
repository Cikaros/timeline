import { describe, expect, test } from 'bun:test'
import { hashSessionToken } from './crypto.js'

describe('hashSessionToken', () => {
  test('creates a deterministic SHA-256 digest', () => {
    const first = hashSessionToken('session-token')
    const second = hashSessionToken('session-token')
    expect(first).toBe(second)
    expect(first).toHaveLength(64)
    expect(first).toMatch(/^[a-f0-9]{64}$/)
  })
})
