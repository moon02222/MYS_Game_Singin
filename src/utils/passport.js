import crypto from 'node:crypto'

/**
 * 判断是否像通行证 ID
 */
function isLikelyPassportId(value) {
  const text = String(value || '').trim()

  if (!text) return false

  return /^\d{5,20}$/.test(text)
}

/**
 * 安全 decodeURIComponent
 */
function safeDecodeURIComponent(value) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/**
 * 从 key=value 文本中提取通行证 ID
 */
function extractFromKeyValueText(text) {
  const source = String(text || '')
  const map = new Map()

  const regex = /(?:^|[;,\s&])([A-Za-z0-9_-]+)=([^;,\s&]+)/g

  for (const match of source.matchAll(regex)) {
    const key = String(match[1] || '').trim().toLowerCase()
    const value = safeDecodeURIComponent(String(match[2] || '').trim())

    if (key && value) {
      map.set(key, value)
    }
  }

  const keys = [
    'account_id',
    'account_id_v2',
    'ltuid',
    'ltuid_v2',
    'login_uid',
    'uid',
    'user_id',
    'userid',
    'aid',
    'ai',
  ]

  for (const key of keys) {
    const value = map.get(key)

    if (isLikelyPassportId(value)) {
      return String(value).trim()
    }
  }

  return ''
}

/**
 * 从对象中提取通行证 ID
 */
function extractFromObject(value) {
  if (!value || typeof value !== 'object') return ''

  const candidates = [
    value.uid,
    value.user_id,
    value.userId,
    value.account_id,
    value.accountId,

    value.data?.uid,
    value.data?.user_id,
    value.data?.userId,
    value.data?.account_id,
    value.data?.accountId,

    value.data?.user_info?.uid,
    value.data?.user_info?.user_id,
    value.data?.user_info?.account_id,

    value.data?.userInfo?.uid,
    value.data?.userInfo?.user_id,
    value.data?.userInfo?.account_id,
  ]

  for (const item of candidates) {
    if (isLikelyPassportId(item)) {
      return String(item).trim()
    }
  }

  return ''
}

/**
 * 提取通行证 ID
 *
 * 支持：
 * - 纯数字字符串
 * - Cookie / Token 里的 key=value
 * - 接口返回对象
 */
export function extractPassportId(value) {
  if (!value) return ''

  if (typeof value === 'object') {
    const fromObject = extractFromObject(value)

    if (fromObject) {
      return fromObject
    }

    try {
      return extractFromKeyValueText(JSON.stringify(value))
    } catch {
      return ''
    }
  }

  const text = String(value || '').trim()

  if (isLikelyPassportId(text)) {
    return text
  }

  return extractFromKeyValueText(text)
}

/**
 * 通行证 ID 打码
 *
 * 示例：
 * 123456789 -> 123****789
 */
export function maskPassportId(value) {
  const text = String(value || '').trim()

  if (!text) return ''

  if (text.length <= 6) {
    return `${text.slice(0, 2)}****`
  }

  if (text.length <= 8) {
    return `${text.slice(0, 3)}****${text.slice(-2)}`
  }

  return `${text.slice(0, 3)}****${text.slice(-3)}`
}

/**
 * 通行证 ID hash
 *
 * 用于日志和邮件分组，不可逆。
 */
export function hashPassportId(value) {
  const text = String(value || '').trim()

  if (!text) return ''

  return crypto
    .createHash('sha256')
    .update(text)
    .digest('hex')
    .slice(0, 16)
}

/**
 * 生成安全通行证信息
 *
 * 不返回完整通行证 ID。
 *
 * 返回：
 * {
 *   passportHash,
 *   passportMasked
 * }
 */
export function getSafePassportInfo(value) {
  const passportId = extractPassportId(value)

  if (!passportId) {
    return {
      passportHash: '',
      passportMasked: '',
    }
  }

  return {
    passportHash: hashPassportId(passportId),
    passportMasked: maskPassportId(passportId),
  }
}