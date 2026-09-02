/**
 * Unified JSON response helpers.
 */
export function jsonResponse(body, status = 200, corsHeaders = {}, extraHeaders = {}) {
  const headers = new Headers({
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    ...corsHeaders
  })

  for (const [key, value] of Object.entries(extraHeaders)) {
    headers.append(key, value)
  }

  return new Response(JSON.stringify(body), { status, headers })
}

export function errorResponse(message, status = 400, corsHeaders = {}) {
  return jsonResponse({ error: message }, status, corsHeaders)
}
