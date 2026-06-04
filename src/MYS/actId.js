/**
 * 米游社 act_id 动态获取工具
 *
 * 职责：
 * - 保存运行期 act_id 缓存
 * - 获取当前 act_id
 * - 从活动页面最终 URL / HTML / JS 中解析 act_id
 * - 在需要时动态获取最新 act_id
 *
 * 注意：
 * - 本文件不负责判断 act_id 是否失效
 * - 是否失效应由 actIdInvalid.js 判断
 * - 动态获取失败时返回 null，不抛出异常，不中断主流程
 */

/**
 * 运行期 act_id 缓存
 *
 * key: gameKey
 * value: latest act_id
 *
 * 说明：
 * - 只在当前 Node.js 进程内有效
 * - GitHub Actions 下一次运行时会重新初始化
 */
const ACT_ID_CACHE = new Map()

/**
 * 获取当前 act_id
 *
 * 优先级：
 * 1. 当前运行期间动态获取到的新 act_id
 * 2. GAME_CONFIG 中配置的默认 act_id
 *
 * @param {string} gameKey 游戏 key，例如 Genshin / StarRail / ZZZ
 * @param {object} gameConfig 单个游戏配置
 * @returns {string}
 */
export function getCurrentActId(gameKey, gameConfig) {
  return ACT_ID_CACHE.get(gameKey) || gameConfig.act_id
}

/**
 * 手动写入 act_id 缓存
 *
 * 一般不需要在主流程直接调用。
 * 主要用于测试或后续扩展。
 *
 * @param {string} gameKey
 * @param {string} actId
 */
export function setCurrentActId(gameKey, actId) {
  if (!gameKey || !isValidActId(actId)) return
  ACT_ID_CACHE.set(gameKey, String(actId).trim())
}

/**
 * 清除指定游戏的 act_id 缓存
 *
 * @param {string} gameKey
 */
export function clearCurrentActId(gameKey) {
  if (!gameKey) return
  ACT_ID_CACHE.delete(gameKey)
}

/**
 * 清除全部 act_id 缓存
 */
export function clearAllActIdCache() {
  ACT_ID_CACHE.clear()
}

/**
 * 判断字符串是否像合法的 act_id
 *
 * 米游社签到 act_id 通常类似：
 * - e202311201442471
 * - e202304121516551
 * - e202406242138391
 *
 * 为降低误匹配风险，这里优先采用较严格格式：
 * - e + 12 到 20 位数字
 *
 * @param {string} actId
 * @returns {boolean}
 */
function isValidActId(actId) {
  const value = String(actId || '').trim()

  if (!value) return false

  return /^e\d{12,20}$/.test(value)
}

/**
 * 从文本中解析 act_id
 *
 * 支持从以下形式中提取：
 * - ?act_id=xxx
 * - &act_id=xxx
 * - act_id=xxx
 * - "act_id":"xxx"
 * - 'act_id':'xxx'
 * - actId: "xxx"
 * - act_id = "xxx"
 *
 * @param {string} text
 * @returns {string|null}
 */
function parseActIdFromText(text) {
  const source = String(text || '')

  const patterns = [
    /[?&]act_id=([a-zA-Z0-9_-]+)/,
    /act_id=([a-zA-Z0-9_-]+)/,
    /["']act_id["']\s*:\s*["']([a-zA-Z0-9_-]+)["']/,
    /["']actId["']\s*:\s*["']([a-zA-Z0-9_-]+)["']/,
    /act_id["']?\s*[:=]\s*["']([a-zA-Z0-9_-]+)["']/,
    /actId["']?\s*[:=]\s*["']([a-zA-Z0-9_-]+)["']/,
  ]

  for (const pattern of patterns) {
    const match = source.match(pattern)
    const actId = match?.[1]

    if (isValidActId(actId)) {
      return String(actId).trim()
    }
  }

  return null
}

/**
 * 从 HTML 中提取 script src 地址
 *
 * @param {string} html
 * @param {string} pageUrl 当前页面地址，用于解析相对路径
 * @returns {string[]}
 */
function extractScriptUrls(html, pageUrl) {
  const urls = []
  const source = String(html || '')

  let base

  try {
    base = new URL(pageUrl)
  } catch {
    return []
  }

  const regex = /<script[^>]+src=["']([^"']+)["']/gi

  for (const match of source.matchAll(regex)) {
    try {
      const url = new URL(match[1], base).toString()
      urls.push(url)
    } catch {
      // 忽略非法 URL
    }
  }

  return [...new Set(urls)]
}

/**
 * 获取 axios 响应的最终 URL
 *
 * Node.js 环境下 axios 经过重定向后，通常可以从：
 * - response.request.res.responseUrl
 * - response.request.responseURL
 *
 * @param {object} response axios response
 * @param {string} fallbackUrl 兜底 URL
 * @returns {string}
 */
function getFinalResponseUrl(response, fallbackUrl) {
  return (
    response?.request?.res?.responseUrl ||
    response?.request?.responseURL ||
    response?.config?.url ||
    fallbackUrl ||
    ''
  )
}

/**
 * 请求并解析一个 JS 文件里的 act_id
 *
 * @param {string} scriptUrl
 * @param {object} gameConfig
 * @param {object} options
 * @param {object} options.axiosInstance
 * @param {string} options.userAgent
 * @param {Function} options.formatAxiosError
 * @returns {Promise<string|null>}
 */
async function fetchActIdFromScript(scriptUrl, gameConfig, options) {
  const {
    axiosInstance,
    userAgent,
    formatAxiosError = (err) => err?.message || String(err),
  } = options

  const gameName = gameConfig.name || '米游社'

  try {
    const jsRes = await axiosInstance.request({
      method: 'GET',
      url: scriptUrl,
      headers: {
        'User-Agent': userAgent || '',
        Accept: '*/*',
        Referer: gameConfig.actPage,
      },
      timeout: 15000,
    })

    const jsText = String(jsRes?.data || '')
    const actIdFromJs = parseActIdFromText(jsText)

    if (actIdFromJs) {
      return actIdFromJs
    }

    return null
  } catch (err) {
    console.warn(`[${gameName}] Fetch script failed: ${formatAxiosError(err)}`)
    return null
  }
}

/**
 * 动态获取最新 act_id
 *
 * 调用时机：
 * - 只建议在某个游戏 act_id 疑似失效时调用
 * - 不建议程序启动时主动调用
 *
 * 获取顺序：
 * 1. 请求活动页面
 * 2. 优先从最终 URL 解析 act_id
 * 3. 再从 HTML 解析 act_id
 * 4. 最后从 HTML 引用的 JS 文件中解析 act_id
 *
 * @param {string} gameKey 游戏 key，例如 Genshin / StarRail / ZZZ
 * @param {object} gameConfig 单个游戏配置
 * @param {object} options
 * @param {object} options.axiosInstance axios 实例
 * @param {string} options.userAgent User-Agent
 * @param {Function} options.formatAxiosError axios 错误格式化函数
 * @returns {Promise<string|null>}
 */
export async function fetchLatestActId(gameKey, gameConfig, options = {}) {
  const {
    axiosInstance,
    userAgent,
    formatAxiosError = (err) => err?.message || String(err),
  } = options

  if (!gameKey) {
    console.warn('[act_id] Missing gameKey, cannot fetch latest act_id')
    return null
  }

  if (!gameConfig) {
    console.warn(`[${gameKey}] Missing gameConfig, cannot fetch latest act_id`)
    return null
  }

  const gameName = gameConfig.name || gameKey

  if (!axiosInstance) {
    console.warn(`[${gameName}] No axiosInstance provided, cannot fetch latest act_id`)
    return null
  }

  if (!gameConfig.actPage) {
    console.warn(`[${gameName}] No actPage configured, cannot fetch latest act_id`)
    return null
  }

  try {
    console.info(`[${gameName}] Trying to fetch latest act_id...`)

    /**
     * 1. 请求活动页面 HTML
     */
    const pageRes = await axiosInstance.request({
      method: 'GET',
      url: gameConfig.actPage,
      headers: {
        'User-Agent': userAgent || '',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      timeout: 15000,
    })

    /**
     * 2. 优先从最终 URL 中解析 act_id
     *
     * 有些活动页会重定向到带 act_id 的 URL，
     * 所以最终 URL 比 HTML 更值得优先解析。
     */
    const finalUrl = getFinalResponseUrl(pageRes, gameConfig.actPage)
    const actIdFromFinalUrl = parseActIdFromText(finalUrl)

    if (actIdFromFinalUrl) {
      ACT_ID_CACHE.set(gameKey, actIdFromFinalUrl)

      console.info(
        `[${gameName}] Latest act_id fetched from final URL: ${actIdFromFinalUrl}`
      )

      return actIdFromFinalUrl
    }

    /**
     * 3. 从 HTML 中解析 act_id
     */
    const html = String(pageRes?.data || '')
    const actIdFromHtml = parseActIdFromText(html)

    if (actIdFromHtml) {
      ACT_ID_CACHE.set(gameKey, actIdFromHtml)

      console.info(`[${gameName}] Latest act_id fetched from HTML: ${actIdFromHtml}`)

      return actIdFromHtml
    }

    /**
     * 4. 从页面引用的 JS 文件中解析 act_id
     */
    const scriptUrls = extractScriptUrls(html, finalUrl || gameConfig.actPage).slice(0, 10)

    if (!scriptUrls.length) {
      console.warn(`[${gameName}] No script urls found from act page`)
    }

    for (const scriptUrl of scriptUrls) {
      const actIdFromJs = await fetchActIdFromScript(scriptUrl, gameConfig, {
        axiosInstance,
        userAgent,
        formatAxiosError,
      })

      if (actIdFromJs) {
        ACT_ID_CACHE.set(gameKey, actIdFromJs)

        console.info(`[${gameName}] Latest act_id fetched from JS: ${actIdFromJs}`)

        return actIdFromJs
      }
    }

    console.warn(`[${gameName}] Failed to parse latest act_id from page`)

    return null
  } catch (err) {
    console.error(`[${gameName}] Fetch latest act_id error: ${formatAxiosError(err)}`)

    return null
  }
}