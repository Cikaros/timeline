import { describe, expect, test } from 'bun:test'
import { corsMiddleware } from './cors.js'

describe('CORS middleware', () => {
  test('short-circuits browser preflight requests', () => {
    const request = new Request('http://localhost/api/health', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5174',
        'Access-Control-Request-Method': 'POST'
      }
    })

    const response = corsMiddleware(request, { 'Access-Control-Allow-Origin': 'http://localhost:5174' })

    expect(response?.status).toBe(204)
  })

  test('lets non-preflight OPTIONS reach CalDAV routes', () => {
    const request = new Request('http://localhost/caldav/', { method: 'OPTIONS' })

    expect(corsMiddleware(request, {})).toBeNull()
  })
})
