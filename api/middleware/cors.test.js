import { describe, expect, test } from 'bun:test'
import { corsMiddleware, getCorsHeaders, isAllowedOrigin } from './cors.js'

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

  test('accepts the public origin reconstructed from proxy headers', () => {
    const request = new Request('http://backend:3000/api/login', {
      method: 'POST',
      headers: {
        Origin: 'https://timeline.example.com',
        'X-Forwarded-Host': 'timeline.example.com',
        'X-Forwarded-Proto': 'https'
      }
    })

    expect(isAllowedOrigin(request)).toBe(true)
    expect(getCorsHeaders(request)['Access-Control-Allow-Origin']).toBe('https://timeline.example.com')
  })

  test('rejects a different browser origin', () => {
    const request = new Request('http://backend:3000/api/login', {
      method: 'POST',
      headers: {
        Origin: 'https://attacker.example',
        'X-Forwarded-Host': 'timeline.example.com',
        'X-Forwarded-Proto': 'https'
      }
    })

    expect(isAllowedOrigin(request)).toBe(false)
    expect(getCorsHeaders(request)).toEqual({})
  })
})
