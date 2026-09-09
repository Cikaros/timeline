import { CONFIG } from '../config/index.js'

export function requestBaseUrl(req) {
  if (CONFIG.PUBLIC_BASE_URL) {
    return new URL(CONFIG.PUBLIC_BASE_URL).origin
  }

  const url = new URL(req.url)
  const forwardedHost = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
  const forwardedProto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
  const host = forwardedHost || req.headers.get('host') || url.host
  const proto = forwardedProto || url.protocol.replace(':', '')
  return `${proto}://${host}`
}
