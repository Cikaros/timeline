import { readFileSync } from 'node:fs'
import { expect, test } from 'bun:test'

test('frontend and backend date parser copies stay in sync', () => {
  const backend = readFileSync(new URL('./dateParser.js', import.meta.url), 'utf8')
  const frontend = readFileSync(
    new URL('../../web/src/utils/dateParser.js', import.meta.url),
    'utf8'
  )
  expect(frontend).toBe(backend)
})
