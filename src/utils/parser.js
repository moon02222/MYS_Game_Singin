/**
 * 解析通用环境变量列表
 * 支持：
 * - 换行分隔
 * - 英文逗号分隔
 */
export function parseEnvList(value) {
  if (!value) return []

  return String(value)
    .split(/\r?\n|,/)
    .map((v) => v.trim())
    .filter(Boolean)
}

/**
 * 解析 Cookie 列表
 */
export function parseCookieList(value) {
  return parseEnvList(value)
}

/**
 * 解析 Token 列表
 */
export function parseTokenList(value) {
  return parseEnvList(value)
}

