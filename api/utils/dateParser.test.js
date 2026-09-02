import { describe, expect, test } from 'bun:test'
import {
  normalizeDateString,
  parseInputToDates,
  iterateDateRange
} from './dateParser.js'

describe('normalizeDateString', () => {
  test('supports compact and separated dates', () => {
    expect(normalizeDateString('20250101')).toBe('2025-01-01')
    expect(normalizeDateString('2025-01-01')).toBe('2025-01-01')
    expect(normalizeDateString('2025/1/1')).toBe('2025-01-01')
    expect(normalizeDateString('2025.01.01')).toBe('2025-01-01')
  })

  test('rejects impossible calendar dates', () => {
    expect(normalizeDateString('20250231')).toBeNull()
    expect(normalizeDateString('2025-02-31')).toBeNull()
  })

  test('does not fall back to locale-dependent Date parsing', () => {
    expect(normalizeDateString('01/01/2025')).toBeNull()
    expect(normalizeDateString('Jan 1, 2025')).toBeNull()
  })
})

describe('parseInputToDates', () => {
  test('supports compact hyphen ranges', () => {
    expect(parseInputToDates('20250101-20250105')).toEqual([
      '2025-01-01',
      '2025-01-02',
      '2025-01-03',
      '2025-01-04',
      '2025-01-05'
    ])
  })

  test('supports ISO date ranges', () => {
    expect(parseInputToDates('2025-01-01~2025-01-03')).toHaveLength(3)
  })

  test('removes duplicate dates', () => {
    expect(parseInputToDates('20250101, 2025-01-01, 20250102')).toEqual([
      '2025-01-01',
      '2025-01-02'
    ])
  })
})

describe('iterateDateRange', () => {
  test('rejects ranges longer than 366 days', () => {
    expect(iterateDateRange('2024-01-01', '2025-01-02')).toEqual([])
  })

  test('accepts a 366-day leap-year range', () => {
    expect(iterateDateRange('2024-01-01', '2024-12-31')).toHaveLength(366)
  })
})
