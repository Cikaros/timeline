import { describe, expect, test } from 'bun:test'
import { subscriptionsRoutes } from './subscriptions.js'

describe('subscriptionsRoutes', () => {
  test('requires authentication for subscription management', async () => {
    const response = await subscriptionsRoutes(
      new Request('http://localhost:3000/api/calendar-subscriptions'),
      { method: 'GET', pathname: '/api/calendar-subscriptions' }
    )

    expect(response.status).toBe(401)
  })

  test('returns not found for an unknown public ICS token', async () => {
    const response = await subscriptionsRoutes(
      new Request('http://localhost:3000/api/calendar/not-found.ics'),
      { method: 'GET', pathname: '/api/calendar/not-found.ics' }
    )

    expect(response.status).toBe(404)
  })

  test('ignores unrelated routes', () => {
    const response = subscriptionsRoutes(
      new Request('http://localhost:3000/api/other'),
      { method: 'GET', pathname: '/api/other' }
    )

    expect(response).toBeNull()
  })
})
