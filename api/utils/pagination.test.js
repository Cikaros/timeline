import { describe, expect, test } from 'bun:test'
import { parsePagination } from './pagination.js'

function params(query) {
  return new URLSearchParams(query)
}

describe('parsePagination', () => {
  test('uses safe defaults', () => {
    expect(parsePagination(params(''))).toEqual({ limit: 1000, offset: 0 })
  })

  test('clamps limit to a positive maximum', () => {
    expect(parsePagination(params('limit=-1')).limit).toBe(1)
    expect(parsePagination(params('limit=0')).limit).toBe(1)
    expect(parsePagination(params('limit=10001')).limit).toBe(10000)
  })

  test('rejects non-integer values', () => {
    expect(parsePagination(params('limit=1.5&offset=2.7'))).toEqual({
      limit: 1000,
      offset: 0
    })
    expect(parsePagination(params('limit=abc&offset=xyz'))).toEqual({
      limit: 1000,
      offset: 0
    })
  })
})
