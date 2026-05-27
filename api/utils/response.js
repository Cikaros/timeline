/**
 * 统一JSON响应工具
 * @param {any} body 响应体
 * @param {number} status 状态码
 * @param {object} corsHeaders CORS头
 * @returns {Response}
 */
export function jsonResponse(body, status = 200, corsHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  })
}

/**
 * 错误响应
 * @param {string} message 错误信息
 * @param {number} status 状态码
 * @param {object} corsHeaders CORS头
 * @returns {Response}
 */
export function errorResponse(message, status = 400, corsHeaders = {}) {
  return jsonResponse({ error: message }, status, corsHeaders)
}