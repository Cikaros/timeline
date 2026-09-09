import { describe, expect, test } from 'bun:test'
import { CONFIG } from '../config/index.js'
import { requestBaseUrl } from './request.js'

describe('request base URL', () => {
  test('uses forwarded proxy headers', () => {
    const original = CONFIG.PUBLIC_BASE_URL
    CONFIG.PUBLIC_BASE_URL = ''
    try {
      const request = new Request('http://backend:3000/api/health', {
        headers: {
          Host: 'backend:3000',
          'X-Forwarded-Host': 'timeline.example.com, backend:3000',
          'X-Forwarded-Proto': 'https,http'
        }
      })

      expect(requestBaseUrl(request)).toBe('https://timeline.example.com')
    } finally {
      CONFIG.PUBLIC_BASE_URL = original
    }
  })

  test('falls back to the original request host', () => {
    const original = CONFIG.PUBLIC_BASE_URL
    CONFIG.PUBLIC_BASE_URL = ''
    try {
      const request = new Request('https://localhost:5174/api/health')
      expect(requestBaseUrl(request)).toBe('https://localhost:5174')
    } finally {
      CONFIG.PUBLIC_BASE_URL = original
    }
  })

  test('uses PUBLIC_BASE_URL as the canonical origin', () => {
    const original = CONFIG.PUBLIC_BASE_URL
    CONFIG.PUBLIC_BASE_URL = 'https://timeline.example.com/app/'
    const request = new Request('http://backend:3000/api/health', {
      headers: {
        Host: 'backend:3000',
        'X-Forwarded-Host': 'timeline.example.com, backend:3000',
        'X-Forwarded-Proto': 'https,http'
      }
    })
    try {
      expect(requestBaseUrl(request)).toBe('https://timeline.example.com')
    } finally {
      CONFIG.PUBLIC_BASE_URL = original
    }
  })
})
