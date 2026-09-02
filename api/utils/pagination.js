export const DEFAULT_PAGE_LIMIT = 1000
export const MAX_PAGE_LIMIT = 10000

export function parsePagination(searchParams) {
  const limitParam = searchParams.get('limit')
  const offsetParam = searchParams.get('offset')
  const rawLimit = limitParam === null ? DEFAULT_PAGE_LIMIT : Number(limitParam)
  const rawOffset = offsetParam === null ? 0 : Number(offsetParam)

  return {
    limit: Number.isInteger(rawLimit)
      ? Math.min(Math.max(rawLimit, 1), MAX_PAGE_LIMIT)
      : DEFAULT_PAGE_LIMIT,
    offset: Number.isInteger(rawOffset) ? Math.max(rawOffset, 0) : 0,
  }
}
