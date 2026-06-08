import { randomSleep, maskUid, formatAxiosError } from '../utils/index.js'
import {
  WEB_HOST,
  mysAxios,
  COMMON_HEADERS,
  SIGN_HEADERS,
  getHeaders,
  getCookieList,
  getRole,
  getMYSAccountInfo,
  logReward,
  hasNextItem,
} from './shared.js'
import {
  getCurrentActId,
  fetchLatestActId,
} from './actId.js'
import {
  isActIdInvalid,
} from './actIdInvalid.js'

/**
 * 游戏配置
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
 * 动态刷新 act_id 并重试签到
 */
async function refreshActIdAndRetrySignIn(cookie, gameKey, role, currentActId) {
  const game = getGameConfig(gameKey)

  const latestActId = await fetchLatestActId(gameKey, game, {
    axiosInstance: mysAxios,
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
 * 执行签到
 */
async function signIn(cookie, gameKey, role, retryOnActIdInvalid = true) {
  const game = getGameConfig(gameKey)

  if (!role?.game_uid) {
    console.error(`[${game.name}] Sign-in skipped: invalid role`)
    return false
  }

  const region = role.region || game.default_region

  if (!region) {
    console.error(`[${game.name}] Sign-in skipped: missing region`)
    return false
  }

  const headers = getHeaders(cookie, {
    ...SIGN_HEADERS,
    'x-rpc-signgame': game.signgame,
  })

  const currentActId = getCurrentActId(gameKey, game)

  const data = {
    act_id: currentActId,
    region,
    uid: role.game_uid,
    lang: 'zh-cn',
  }

  try {
    const res = await mysAxios.request({
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

  const region = role.region || game.default_region

  if (!region) {
    console.error(`[${game.name}] Get reward skipped: missing region`)
    return null
  }

  const headers = getHeaders(cookie, {
    ...SIGN_HEADERS,
    'x-rpc-signgame': game.signgame,
  })

  const query = new URLSearchParams({
    act_id: getCurrentActId(gameKey, game),
    region,
    uid: role.game_uid,
    lang: 'zh-cn',
  }).toString()

  try {
    const [infoRes, homeRes] = await Promise.all([
      mysAxios.request({
        method: 'GET',
        headers,
        url: `https://${WEB_HOST}/event/luna/${game.signgame}/info?${query}`,
      }),
      mysAxios.request({
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
 * 米游社签到入口
 */
async function doMYSSign(gameKey) {
  const game = getGameConfig(gameKey)
  const cookieList = getCookieList()

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

    const roleResult = await getRole(cookie, game)

    if (roleResult.status === 'no_role') {
      noRole++

      if (hasNextItem(cookieIndex, cookieList)) {
        await randomSleep(1, 3)
      }

      continue
    }

    if (roleResult.status === 'failed') {
      failed++

      if (hasNextItem(cookieIndex, cookieList)) {
        await randomSleep(1, 3)
      }

      continue
    }

    const role = roleResult.role

    if (role?.game_uid) {
      signedTotal++

      const ok = await signIn(cookie, gameKey, role)

      if (ok) {
        const reward = await getSignReward(cookie, gameKey, role)

        if (reward) {
          const accountInfo = await getMYSAccountInfo(cookie, game)
          logReward(game.name, cookieIndex, role, reward, accountInfo)
        }
      } else {
        failed++
      }
    } else {
      failed++
    }

    if (hasNextItem(cookieIndex, cookieList)) {
      await randomSleep(1, 3)
    }
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