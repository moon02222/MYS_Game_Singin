/**
 * 通用敏感信息脱敏
 */
export function maskSensitive(text) {
  return String(text ?? '')
    .replace(/(cookie_token=)[^;,\s]+/gi, '$1***')
    .replace(/(ltoken=)[^;,\s]+/gi, '$1***')
    .replace(/(ltuid=)[^;,\s]+/gi, '$1***')
    .replace(/(stoken=)[^;,\s]+/gi, '$1***')
    .replace(/(account_id=)\d+/gi, '$1***')
    .replace(/(login_ticket=)[^;,\s]+/gi, '$1***')
    .replace(/("Cookie"\s*:\s*")[^"]+/gi, '$1***')
    .replace(/(Cookie:\s*)[^\n\r]+/gi, '$1***')
    .replace(/(Authorization["']?\s*[:=]\s*["']?Bearer\s+)[^"',\s}]+/gi, '$1***')
    .replace(/(Authorization:\s*Bearer\s+)[A-Za-z0-9._-]+/gi, '$1***')
    .replace(/(x-rpc-combo_token["']?\s*[:=]\s*["']?)[^"',\s}]+/gi, '$1***')
    .replace(/(combo_token=)[^;&\s]+/gi, '$1***')
    .replace(/(token["']?\s*[:=]\s*["']?)[^"',\s}]+/gi, '$1***')
}

/**
 * UID 打码
 */
export function maskUid(uid) {
  const value = String(uid || '')

  if (value.length <= 4) return '****'

  return `${value.slice(0, 3)}****${value.slice(-2)}`
}
