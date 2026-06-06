import axios from 'axios'
import md5 from 'md5'
import { v4 as uuidv4 } from 'uuid'
import {
  randomSleep,
  parseCookieList,
  maskUid,
  formatAxiosError,
  getSafePassportInfo,
} from '../utils/index.js'
import {
  getCurrentActId,
  fetchLatestActId,
} from './actId.js'
import {
  isActIdInvalid,
} from './actIdInvalid.js'

/**
 * 米游社接口主机
 */
const WEB_HOST = 'api-takumi.mihoyo.com'

/**
 * 米游社用户信息接口主机
 */
const BBS_HOST = 'bbs-api.miyoushe.com'

/**
 * 模拟米游社 App 版本
 */
const APP_VERSION = '2.81.1'

/**
 * 设备 ID
 * 推荐在 GitHub Secrets 中配置 MYS_DEVICE_ID，使其长期固定
 * 如果没有配置，则每次运行临时生成一个
 */
const DEVICE_ID = process.env.MYS_DEVICE_ID || uuidv4()

/**
 * axios 实例
 * 设置 timeout 避免接口卡死
 */
const $axios = axios.create({
  timeout: 15000,
})

/**
 * 游戏配置
 *
 * act_id:
 * - 默认使用这里配置的固定 act_id
 * - 只有当签到接口判断 act_id 疑似失效时，才会动态刷新
 *
 * actPage:
 * - 用于动态解析最新 act_id
 * - 如果官方页面结构变化，可能解析失败
 * - 解析失败不会中断整体流程，只会继续按失败处理
 */
const GAME_CONFIG = {
  Genshin: {
    name: '原神-米游社',
    game_biz: 'hk4e_cn',
    act_id: 'e202311201442471',
    signgame: 'hk4e',
    default_region: 'cn_gf01',
    actPage: 'https://act.mihoyo.com/bbs/event/signin/hk4e/index.html',
  },
  StarRail: {
    name: '星穹铁道-米游社',
    game_biz: 'hkrpg_cn',
    act_id: 'e202304121516551',
    signgame: 'hkrpg',
    default_region: 'prod_gf_cn',
    actPage: 'https://act.mihoyo.com/bbs/event/signin/hkrpg/index.html',
  },
  ZZZ: {
    name: '绝区零-米游社',
    game_biz: 'nap_cn',
    act_id: 'e202406242138391',
    signgame: 'zzz',
    default_region: 'prod_gf_cn',
    actPage: 'https://act.mihoyo.com/bbs/event/signin/zzz/index.html',
  },
}

/**
 * 公共请求头
 */
const COMMON_HEADERS = {
  DS: '',
  Cookie: '',
  Host: WEB_HOST,
  'User-Agent': `Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) miHoYoBBS/${APP_VERSION}`,
  'x-rpc-app_version': APP_VERSION,
  'x-rpc-client_type': 5,
  'Accept-Language': 'zh-CN,zh-Hans;q=0.9',
  Accept: 'application/json, text/plain, */*',
}

/**
 * 查询角色信息时使用的请求头
 */
const ROLE_HEADERS = {
  Referer: 'https://webstatic.mihoyo.com/',
  'x-rpc-device_id': DEVICE_ID,
  Origin: 'https://webstatic.mihoyo.com',
  'x-rpc-challenge': 'null',
  Accept: 'application/json, text/plain, */*',
  'Accept-Encoding': 'gzip, deflate, br',
}

/**
 * 签到时使用的请求头
 */
const SIGN_HEADERS = {
  Referer: 'https://act.mihoyo.com/',
  'x-rpc-device_model': 'iPhone14,4',
  'x-rpc-device_id': DEVICE_ID,
  'x-rpc-platform': 1,
  'x-rpc-device_name': 'iPhone',
  Origin: 'https://act.mihoyo.com',
  'Sec-Fetch-Site': 'same-site',
  Connection: 'keep-alive',
  'Content-Type': 'application/json;charset=utf-8',
}

/**
 * 获取游戏配置
 */
function getGameConfig(gameKey) {
  const config = GAME_CONFIG[gameKey]

  if (!config) {
    throw new Error(`Unsupported gameKey: ${gameKey}`)
  }

  return config
}

/**
 * 读取 MYS_COOKIES
 */
function getCookieConfig() {
  const mysCookies = process.env.MYS_COOKIES

  if (!mysCookies) {
    console.info('[米游社] No MYS_COOKIES configured, skip MYS tasks.')
    return { Genshin: [], StarRail: [], ZZZ: [] }
  }

  const cookieList = parseCookieList(mysCookies)

  return {
    Genshin: cookieList,
    StarRail: cookieList,
    ZZZ: cookieList,
  }
}

/**
 * 生成米游社 DS
 */
function getDS() {
  const salt = 'yUZ3s0Sna1IrSNfk29Vo6vRapdOyqyhB'
  const t = Math.floor(Date.now() / 1e3)
  const r = Math.random().toString(36).slice(-6)
  const c = `salt=${salt}&t=${t}&r=${r}`

  return `${t},${r},${md5(c)}`
}

/**
 * 组合请求头
 */
async function getHeaders(cookie, whichHeader) {
  return {
    ...COMMON_HEADERS,
    ...whichHeader,
    Cookie: cookie,
    DS: getDS(),
  }
}

/**
 * 获取米游社账号信息
 *
 * 返回：
 * {
 *   mysNickname,
 *   passportHash,
 *   passportMasked
 * }
 *
 * 注意：
 * - 不返回完整 passportId
 * - 获取失败不影响签到
 */
async function getMYSAccountInfo(cookie, gameKey) {
  const game = getGameConfig(gameKey)
  const fallbackSafeInfo = getSafePassportInfo(cookie)

  try {
    const res = await $axios.request({
      method: 'GET',
      url: `https://${BBS_HOST}/user/wapi/getUserFullInfo?gids=2`,
      headers: {
        Cookie: cookie,
        Host: BBS_HOST,
        Referer: 'https://www.miyoushe.com/',
        Origin: 'https://www.miyoushe.com',
        'User-Agent': COMMON_HEADERS['User-Agent'],
        Accept: 'application/json, text/plain, */*',
      },
    })

    const data = res?.data

    if (data?.retcode === 0) {
      const mysNickname =
        data.data?.user_info?.nickname ||
        data.data?.userInfo?.nickname ||
        data.data?.nickname ||
        ''

      const safeInfoFromResponse = getSafePassportInfo(data)

      if (mysNickname) {
        console.log(`[${game.name}] MYS account nickname fetched`)
      }

      return {
        mysNickname,
        passportHash: safeInfoFromResponse.passportHash || fallbackSafeInfo.passportHash,
        passportMasked: safeInfoFromResponse.passportMasked || fallbackSafeInfo.passportMasked,
      }
    }

    console.warn(
      `[${game.name}] Get MYS account info failed: retcode=${data?.retcode}, message=${data?.message}`
    )

    return {
      mysNickname: '',
      ...fallbackSafeInfo,
    }
  } catch (err) {
    console.warn(`[${game.name}] Get MYS account info error: ${formatAxiosError(err)}`)

    return {
      mysNickname: '',
      ...fallbackSafeInfo,
    }
  }
}

/**
 * 动态刷新 act_id 并重试签到
 *
 * 返回：
 * - true：刷新成功并重试签到成功
 * - false：刷新失败、无新 act_id、或重试失败
 */
async function refreshActIdAndRetrySignIn(cookie, gameKey, role, currentActId) {
  const game = getGameConfig(gameKey)

  const latestActId = await fetchLatestActId(gameKey, game, {
    axiosInstance: $axios,
    userAgent: COMMON_HEADERS['User-Agent'],
    formatAxiosError,
  })

  if (!latestActId) {
    console.warn(`[${game.name}] Failed to fetch latest act_id, skip retry`)
    return false
  }

  if (latestActId === currentActId) {
    console.warn(`[${game.name}] Latest act_id is same as current act_id, skip retry`)
    return false
  }

  console.info(`[${game.name}] Retry sign-in with latest act_id=${latestActId}`)

  return signIn(cookie, gameKey, role, false)
}

/**
 * 获取账号绑定角色
 *
 * 返回结构：
 * - status: 'ok'      找到对应游戏角色
 * - status: 'no_role' Cookie 有效，但没有这个游戏的角色
 * - status: 'failed'  Cookie 失效、接口异常或其他登录失败
 */
async function getRole(cookie, gameKey) {
  const game = getGameConfig(gameKey)
  const headers = await getHeaders(cookie, ROLE_HEADERS)

  try {
    const res = await $axios.request({
      method: 'GET',
      headers,
      url: `https://${WEB_HOST}/binding/api/getUserGameRolesByCookie?game_biz=${game.game_biz}`,
    })

    const data = res?.data

    if (!data) {
      console.error(`[${game.name}] Login failed: empty response`)
      return {
        status: 'failed',
        role: null,
      }
    }

    if (data.retcode !== 0) {
      console.error(`[${game.name}] Login failed: retcode=${data.retcode}, message=${data.message}`)
      return {
        status: 'failed',
        role: null,
      }
    }

    const role = data.data?.list?.[0]

    if (!role?.game_uid) {
      console.info(`[${game.name}] No character found, skip this account`)
      return {
        status: 'no_role',
        role: null,
      }
    }

    console.log(
      `[${game.name}] Login successful <${role.nickname}(${maskUid(role.game_uid)})>`
    )

    return {
      status: 'ok',
      role,
    }
  } catch (err) {
    console.error(`[${game.name}] Login error: ${formatAxiosError(err)}`)
    return {
      status: 'failed',
      role: null,
    }
  }
}

/**
 * 执行签到
 *
 * retryOnActIdInvalid:
 * - true:  如果疑似 act_id 失效，则动态获取最新 act_id 并重试一次
 * - false: 防止无限递归重试
 */
async function signIn(cookie, gameKey, role, retryOnActIdInvalid = true) {
  const game = getGameConfig(gameKey)

  if (!role?.game_uid) {
    console.error(`[${game.name}] Sign-in skipped: invalid role`)
    return false
  }

  const headers = await getHeaders(cookie, {
    ...SIGN_HEADERS,
    'x-rpc-signgame': game.signgame,
  })

  const currentActId = getCurrentActId(gameKey, game)

  const data = {
    act_id: currentActId,
    region: role.region || game.default_region,
    uid: role.game_uid,
    lang: 'zh-cn',
  }

  try {
    const res = await $axios.request({
      method: 'POST',
      headers,
      data,
      url: `https://${WEB_HOST}/event/luna/${game.signgame}/sign`,
    })

    const body = res?.data

    if (!body) {
      console.error(`[${game.name}] Sign-in failed: empty response`)
      return false
    }

    const message = body.message || 'Unknown'
    const retcode = body.retcode

    if (
      message === 'OK' ||
      retcode === 0 ||
      /已签到|已经签到|签到过|今日已签到|already/i.test(message)
    ) {
      console.log(
        `[${game.name}] <${role.nickname}(${maskUid(role.game_uid)})> Sign-in successful`
      )
      return true
    }

    /**
     * act_id 疑似失效时，只动态刷新当前游戏 act_id，并重试一次
     */
    if (retryOnActIdInvalid && isActIdInvalid(body)) {
      console.warn(
        `[${game.name}] act_id may be invalid, current act_id=${currentActId}, trying to refresh...`
      )

      const retryOk = await refreshActIdAndRetrySignIn(
        cookie,
        gameKey,
        role,
        currentActId
      )

      if (retryOk) {
        return true
      }

      console.warn(`[${game.name}] Retry after refreshing act_id failed`)
    }

    console.error(
      `[${game.name}] <${role.nickname}(${maskUid(role.game_uid)})> Sign-in failed: retcode=${retcode}, message=${message}`
    )

    return false
  } catch (err) {
    const errorBody = err?.response?.data

    /**
     * 某些 act_id 错误可能以非 2xx HTTP 状态返回，axios 会进入 catch
     * 所以这里也判断一次
     */
    if (retryOnActIdInvalid && isActIdInvalid(errorBody)) {
      console.warn(
        `[${game.name}] act_id may be invalid from error response, current act_id=${currentActId}, trying to refresh...`
      )

      const retryOk = await refreshActIdAndRetrySignIn(
        cookie,
        gameKey,
        role,
        currentActId
      )

      if (retryOk) {
        return true
      }

      console.warn(`[${game.name}] Retry after refreshing act_id failed`)
    }

    console.error(`[${game.name}] Sign-in error: ${formatAxiosError(err)}`)
    return false
  }
}

/**
 * 查询当前累计签到天数和今日奖励
 */
async function getSignReward(cookie, gameKey, role) {
  const game = getGameConfig(gameKey)

  if (!role?.game_uid) {
    return null
  }

  const headers = await getHeaders(cookie, {
    ...SIGN_HEADERS,
    'x-rpc-signgame': game.signgame,
  })

  const query = new URLSearchParams({
    act_id: getCurrentActId(gameKey, game),
    region: role.region || game.default_region,
    uid: role.game_uid,
    lang: 'zh-cn',
  }).toString()

  try {
    const [infoRes, homeRes] = await Promise.all([
      $axios.request({
        method: 'GET',
        headers,
        url: `https://${WEB_HOST}/event/luna/${game.signgame}/info?${query}`,
      }),
      $axios.request({
        method: 'GET',
        headers,
        url: `https://${WEB_HOST}/event/luna/${game.signgame}/home?${query}`,
      }),
    ])

    const infoData = infoRes?.data
    const homeData = homeRes?.data

    if (infoData?.retcode !== 0 || homeData?.retcode !== 0) {
      console.error(
        `[${game.name}] Get reward failed: retcode=${infoData?.retcode ?? homeData?.retcode}, message=${infoData?.message ?? homeData?.message}`
      )
      return null
    }

    const totalSignDay = Number(infoData.data?.total_sign_day ?? 0)
    const awards = homeData.data?.awards || []

    if (!totalSignDay || !awards.length) {
      return null
    }

    const award = awards[totalSignDay - 1]

    if (!award) {
      return null
    }

    return {
      day: totalSignDay,
      name: award.name || '',
      cnt: award.cnt ?? '',
      icon: award.icon || '',
    }
  } catch (err) {
    console.error(`[${game.name}] Get reward error: ${formatAxiosError(err)}`)
    return null
  }
}

/**
 * 输出奖励日志，供邮件摘要解析
 *
 * 注意：
 * - 不输出完整通行证 ID
 * - passportHash 用于同账号匹配
 * - passportMasked 用于邮件展示
 */
function logReward(gameName, cookieIndex, role, reward, accountInfo = {}) {
  if (!reward) return

  console.log(
    `[${gameName}] Reward: ${JSON.stringify({
      user: cookieIndex + 1,
      passportHash: accountInfo.passportHash || '',
      passportMasked: accountInfo.passportMasked || '',
      mysNickname: accountInfo.mysNickname || '',
      uid: maskUid(role.game_uid),
      day: reward.day,
      name: reward.name,
      cnt: reward.cnt,
      icon: reward.icon,
    })}`
  )
}

/**
 * 米游社签到入口
 *
 * 逻辑：
 * - 没有 Cookie：跳过
 * - Cookie 有效但没有对应游戏角色：跳过该账号，不算失败
 * - 某个游戏所有账号都没有角色：该游戏整体 skipped=true
 * - Cookie 失效 / 接口异常 / 签到失败：算失败
 * - act_id 疑似失效时，只动态刷新当前游戏的 act_id 并重试一次
 */
async function doMYSSign(gameKey) {
  const game = getGameConfig(gameKey)
  const CONF = getCookieConfig()
  const cookieList = CONF[gameKey] || []

  if (!cookieList.length) {
    console.info(`[${game.name}] Skip: no cookie configured`)

    return {
      gameKey,
      total: 0,
      failed: 0,
      skipped: true,
      success: true,
    }
  }

  console.info(`[${game.name}] Start signing in, total ${cookieList.length} cookies\n`)

  let signedTotal = 0
  let failed = 0
  let noRole = 0

  for (const [cookieIndex, cookie] of cookieList.entries()) {
    if (!cookie) continue

    console.log(`[${game.name}] User ${cookieIndex + 1} starts signing in...`)

    const roleResult = await getRole(cookie, gameKey)

    if (roleResult.status === 'no_role') {
      noRole++
      await randomSleep(1, 3)
      continue
    }

    if (roleResult.status === 'failed') {
      failed++
      await randomSleep(3, 9)
      continue
    }

    const role = roleResult.role

    if (role?.game_uid) {
      signedTotal++

      const ok = await signIn(cookie, gameKey, role)

      if (ok) {
        const reward = await getSignReward(cookie, gameKey, role)

        if (reward) {
          const accountInfo = await getMYSAccountInfo(cookie, gameKey)
          logReward(game.name, cookieIndex, role, reward, accountInfo)
        }
      } else {
        failed++
      }
    } else {
      failed++
    }

    await randomSleep(3, 9)
  }

  if (signedTotal === 0 && failed === 0) {
    console.info(`[${game.name}] No matching characters found in all cookies, skipped\n`)

    return {
      gameKey,
      total: 0,
      failed: 0,
      skipped: true,
      success: true,
      noRole,
    }
  }

  console.info(
    `[${game.name}] Sign-in completed, signed users: ${signedTotal}, failed: ${failed}, no role: ${noRole}\n`
  )

  return {
    gameKey,
    total: signedTotal,
    failed,
    skipped: false,
    success: failed === 0,
    noRole,
  }
}

export { doMYSSign }