import { describe, expect, test } from 'bun:test'
import { errorResponse, jsonResponse } from './response.js'

describe('JSON responses', () => {
  test('disables shared caching', () => {
    const response = jsonResponse({ ok: true })
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })

  test('supports extra headers such as Set-Cookie', () => {
    const response = jsonResponse({ ok: true }, 200, {}, { 'Set-Cookie': 'session=test' })
    expect(response.headers.get('Set-Cookie')).toBe('session=test')
  })

  test('returns error bodies with the requested status', () => {
    const response = errorResponse('未授权', 401)
    expect(response.status).toBe(401)
    expect(response.headers.get('Content-Type')).toBe('application/json')
  })
})
