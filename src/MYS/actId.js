/**
 * 米游社 ACT_ID 自动刷新工具。
 *
 * 最新 ACT_ID 只从米游社首页导航的签到入口深链解析。远端深链仅作为不可信数据读取，
 * 不会被打开或继续请求；候选值须由调用方使用当前账号的签到信息接口只读验证。
 */

/** 运行期 ACT_ID 缓存：gameKey -> 已验证 ACT_ID。 */
const ACT_ID_CACHE = new Map()

const NAVIGATION_HOST = 'bbs-api.miyoushe.com'
const NAVIGATION_PATH = '/apihub/api/home/new'
const MAX_NAVIGATION_BYTES = 1024 * 1024
const MAX_REDIRECTS = 5
const VALID_ACT_ID = /^e\d{12,20}$/

/** 获取当前生效的 ACT_ID；动态缓存无有效值时回退到内置值。 */
export function getCurrentActId(gameKey, gameConfig) {
  const cached = ACT_ID_CACHE.get(gameKey)
  return isValidActId(cached) ? cached : gameConfig.act_id
}

/** 写入当前进程的、已经只读验证通过的 ACT_ID。 */
export function setCurrentActId(gameKey, actId) {
  if (!gameKey || !isValidActId(actId)) return false
  ACT_ID_CACHE.set(gameKey, String(actId).trim())
  return true
}

/** 清除指定游戏的 ACT_ID 缓存。 */
export function clearCurrentActId(gameKey) {
  if (gameKey) ACT_ID_CACHE.delete(gameKey)
}

/** 清除全部 ACT_ID 缓存。 */
export function clearAllActIdCache() {
  ACT_ID_CACHE.clear()
}

export function isValidActId(actId) {
  return VALID_ACT_ID.test(String(actId || '').trim())
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isIpLiteral(hostname) {
  if (hostname.includes(':')) return true
  const parts = hostname.split('.')
  return parts.length === 4 && parts.every((part) => /^\d+$/.test(part) && Number(part) <= 255)
}

function hasUnsafeUrlText(rawUrl) {
  return (
    typeof rawUrl !== 'string' ||
    !rawUrl ||
    rawUrl !== rawUrl.trim() ||
    /[\s\\\u0000-\u001f\u007f]/.test(rawUrl)
  )
}

function parseNavigationUrl(rawUrl, expectedGid) {
  if (hasUnsafeUrlText(rawUrl)) return null

  try {
    const url = new URL(rawUrl)
    if (url.protocol !== 'https:' || (url.port && url.port !== '443')) return null
    if (url.username || url.password || url.hash) return null
    if (url.hostname.toLowerCase() !== NAVIGATION_HOST || isIpLiteral(url.hostname)) return null
    if (url.pathname !== NAVIGATION_PATH) return null

    const entries = [...url.searchParams.entries()]
    if (entries.length !== 1 || entries[0][0] !== 'gids' || entries[0][1] !== String(expectedGid)) {
      return null
    }
    return url
  } catch {
    return null
  }
}

function getFinalResponseUrl(response, fallbackUrl) {
  return (
    response?.request?.res?.responseUrl ||
    response?.request?.responseURL ||
    response?.config?.url ||
    fallbackUrl ||
    ''
  )
}

function normalizeSourceConfig(gameConfig) {
  const source = gameConfig?.actIdSource
  const gid = Number(source?.bbsGid)
  const host = String(source?.host || '').toLowerCase()
  let basePath = String(source?.basePath || '')

  if (!Number.isInteger(gid) || gid <= 0 || !host || isIpLiteral(host)) return null
  if (!basePath.startsWith('/') || /[%?#\\]/.test(basePath)) return null
  if (!basePath.endsWith('/')) basePath += '/'

  return {
    bbsGid: gid,
    host,
    basePath,
    allowActIdFilename: source?.allowActIdFilename === true,
  }
}

/**
 * 从一个签到入口深链中提取与当前游戏严格绑定的候选值。
 * 查询键和值均不接受编码形式；ACT_ID 参数必须唯一，动态文件名存在时必须与参数一致。
 */
export function parseActIdFromNavigationPath(rawPath, gameConfig) {
  const source = normalizeSourceConfig(gameConfig)
  if (!source || hasUnsafeUrlText(rawPath) || rawPath.includes('%')) return null

  let url
  try {
    url = new URL(rawPath)
  } catch {
    return null
  }

  if (url.protocol !== 'https:' || (url.port && url.port !== '443')) return null
  if (url.username || url.password || url.hash || isIpLiteral(url.hostname)) return null
  if (url.hostname.toLowerCase() !== source.host) return null

  const rawPairs = url.search.slice(1).split('&').filter(Boolean)
  const actIdPairs = rawPairs.filter((pair) => pair.split('=', 1)[0] === 'act_id')
  if (actIdPairs.length !== 1) return null

  const pairParts = actIdPairs[0].split('=')
  if (pairParts.length !== 2 || !isValidActId(pairParts[1])) return null
  const candidate = pairParts[1]

  const acceptedPaths = new Set([
    source.basePath,
    `${source.basePath}index.html`,
  ])
  if (source.allowActIdFilename) {
    acceptedPaths.add(`${source.basePath}${candidate}.html`)
  }
  if (!acceptedPaths.has(url.pathname)) return null

  const filename = url.pathname.slice(source.basePath.length)
  const filenameActId = filename.match(/^(e\d{12,20})\.html$/)?.[1]
  if (filenameActId && filenameActId !== candidate) return null

  return candidate
}

/** 从首页导航响应中提取唯一、来源绑定正确的候选 ACT_ID。 */
export function parseActIdFromNavigation(body, gameConfig) {
  if (!isPlainObject(body) || body.retcode !== 0 || !isPlainObject(body.data)) return null
  if (!Array.isArray(body.data.navigator)) return null

  const candidates = new Set()
  let rejectedGamePath = false

  for (const entry of body.data.navigator) {
    if (!isPlainObject(entry) || typeof entry.app_path !== 'string') continue
    const candidate = parseActIdFromNavigationPath(entry.app_path, gameConfig)
    if (candidate) {
      candidates.add(candidate)
    } else {
      const source = normalizeSourceConfig(gameConfig)
      if (source && entry.app_path.includes(source.basePath)) rejectedGamePath = true
    }
  }

  if (rejectedGamePath || candidates.size !== 1) return null
  return [...candidates][0]
}

/**
 * 无凭证读取固定 gids 对应的米游社首页导航，并解析当前游戏的签到入口。
 * 请求不会携带 Cookie、Token、DS、UID 或设备标识。
 */
export async function fetchLatestActId(gameKey, gameConfig, options = {}) {
  const source = normalizeSourceConfig(gameConfig)
  const axiosInstance = options.axiosInstance
  const formatAxiosError = options.formatAxiosError || ((err) => err?.message || String(err))
  const gameName = gameConfig?.name || gameKey || 'ACT_ID'

  if (!gameKey || !source || !axiosInstance) {
    console.warn(`[${gameName}] ACT_ID refresh configuration is invalid`)
    return null
  }

  const requestUrl = `https://${NAVIGATION_HOST}${NAVIGATION_PATH}?gids=${source.bbsGid}`

  try {
    console.info(`[${gameName}] Reading ACT_ID from MYS home navigation`)
    const response = await axiosInstance.request({
      method: 'GET',
      url: requestUrl,
      headers: {
        'User-Agent': options.userAgent || '',
        Accept: 'application/json',
      },
      timeout: 15000,
      maxContentLength: MAX_NAVIGATION_BYTES,
      maxBodyLength: MAX_NAVIGATION_BYTES,
      maxRedirects: MAX_REDIRECTS,
      beforeRedirect: (redirectOptions) => {
        const candidate = redirectOptions?.href ||
          `${redirectOptions?.protocol || ''}//${redirectOptions?.hostname || ''}${redirectOptions?.path || ''}`
        if (!parseNavigationUrl(candidate, source.bbsGid)) {
          throw new Error('Untrusted ACT_ID navigation redirect')
        }
      },
    })

    if (!Number.isInteger(response?.status) || response.status < 200 || response.status >= 300) {
      console.warn(`[${gameName}] ACT_ID navigation returned a non-success HTTP status`)
      return null
    }

    const finalUrl = getFinalResponseUrl(response, requestUrl)
    if (!parseNavigationUrl(finalUrl, source.bbsGid)) {
      console.warn(`[${gameName}] ACT_ID navigation final URL is not trusted`)
      return null
    }

    const candidate = parseActIdFromNavigation(response.data, gameConfig)
    if (!candidate) {
      console.warn(`[${gameName}] ACT_ID navigation did not contain one trusted candidate`)
      return null
    }
    return candidate
  } catch (err) {
    console.warn(`[${gameName}] ACT_ID navigation read failed: ${formatAxiosError(err)}`)
    return null
  }
}

/**
 * 完成候选读取、只读验证、缓存和最多一次安全重试。
 * verifyCandidate 返回 { valid, isSigned }；只有 valid=true 的候选才可能进入缓存。
 */
export async function refreshActIdAndRetry(options) {
  const {
    gameKey,
    gameConfig,
    staleActId,
    verifyCandidate,
    retrySignIn,
  } = options || {}
  const gameName = gameConfig?.name || gameKey || 'ACT_ID'

  const candidate = await fetchLatestActId(gameKey, gameConfig, options)
  if (!candidate) return { status: 'fetch-failed', success: false }

  let verification
  try {
    verification = await verifyCandidate(candidate)
  } catch (err) {
    const formatAxiosError = options.formatAxiosError || ((error) => error?.message || String(error))
    console.warn(`[${gameName}] ACT_ID candidate verification failed: ${formatAxiosError(err)}`)
    return { status: 'verification-failed', success: false }
  }

  if (verification?.valid !== true || typeof verification.isSigned !== 'boolean') {
    console.warn(`[${gameName}] ACT_ID candidate did not pass read-only verification`)
    return { status: 'verification-failed', success: false }
  }

  if (verification.isSigned) {
    setCurrentActId(gameKey, candidate)
    console.info(`[${gameName}] ACT_ID candidate confirms that today is already signed`)
    return { status: 'already-signed', success: true, actId: candidate }
  }

  if (candidate === staleActId) {
    console.warn(`[${gameName}] ACT_ID candidate is unchanged; skip sign-in retry`)
    return { status: 'unchanged', success: false, actId: candidate }
  }

  setCurrentActId(gameKey, candidate)
  console.info(`[${gameName}] ACT_ID candidate verified; retry sign-in once with act_id=${candidate}`)
  const success = await retrySignIn()
  return {
    status: success ? 'retry-succeeded' : 'retry-failed',
    success: Boolean(success),
    actId: candidate,
  }
}
