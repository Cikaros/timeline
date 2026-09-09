import { describe, expect, test } from 'bun:test'
import { caldavRoutes } from './caldav.js'

describe('CalDAV routes', () => {
  test('redirects CalDAV well-known discovery with and without a trailing slash', () => {
    for (const pathname of ['/.well-known/caldav', '/.well-known/caldav/']) {
      const response = caldavRoutes(
        new Request(`http://localhost${pathname}`, { method: 'PROPFIND' }),
        { pathname }
      )

      expect(response.status).toBe(307)
      expect(response.headers.get('Location')).toBe('/caldav/')
    }
  })
})
