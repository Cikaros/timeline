import { describe, expect, test } from 'bun:test'
import { healthRoutes } from './health.js'

describe('healthRoutes', () => {
  test('returns ok for GET /api/health', async () => {
    const req = new Request('http://localhost:3000/api/health', { method: 'GET' })
    const response = await healthRoutes(req, {
      method: 'GET',
      pathname: '/api/health'
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
  })

  test('ignores other routes', async () => {
    const req = new Request('http://localhost:3000/api/other', { method: 'GET' })
    const response = await healthRoutes(req, {
      method: 'GET',
      pathname: '/api/other'
    })
    expect(response).toBeNull()
  })
})
