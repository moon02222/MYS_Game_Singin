import { randomSleep, maskUid, formatAxiosError } from '../../utils/index.js'
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
} from '../shared.js'
import {
  getCurrentActId,
  refreshActIdAndRetry,
} from '../actId.js'
import {
  isActIdInvalid,
} from '../actIdInvalid.js'

const LUNA_HOME_URL = `https://${WEB_HOST}/event/luna/home`
const LUNA_INFO_URL = `https://${WEB_HOST}/event/luna/info`
const LUNA_SIGN_URL = `https://${WEB_HOST}/event/luna/sign`

/**
 * 通用 Luna 接口游戏配置
 */
const LUNA_COMMON_GAME_CONFIG = {
  Honkai2: {
    name: '崩坏学园2-米游社',
    game_biz: 'bh2_cn',
    act_id: 'e202203291431091',
    default_region: '',
    actIdSource: { bbsGid: 3, host: 'webstatic.mihoyo.com', basePath: '/bbs/event/signin/bh2/' },
  },
  Honkai3rd: {
    name: '崩坏3-米游社',
    game_biz: 'bh3_cn',
    act_id: 'e202306201626331',
    default_region: '',
    actIdSource: { bbsGid: 1, host: 'webstatic.mihoyo.com', basePath: '/bbs/event/signin/bh3/' },
  },
  TearsOfThemis: {
    name: '未定事件簿-米游社',
    game_biz: 'nxx_cn',
    act_id: 'e202202251749321',
    default_region: '',
    actIdSource: { bbsGid: 4, host: 'webstatic.mihoyo.com', basePath: '/bbs/event/signin/nxx/' },
  },
}

/**
 * 获取游戏配置
 */
function getGameConfig(gameKey) {
  const config = LUNA_COMMON_GAME_CONFIG[gameKey]

  if (!config) {
    throw new Error(`Unsupported luna common gameKey: ${gameKey}`)
  }

  return config
}

/**
 * 获取通用 Luna Referer
 */
function getLunaCommonReferer(gameKey, game, actId = getCurrentActId(gameKey, game)) {
  const query = new URLSearchParams({
    bbs_auth_required: 'true',
    act_id: actId,
    bbs_presentation_style: 'fullscreen',
    utm_source: 'bbs',
    utm_medium: 'mys',
    utm_campaign: 'icon',
  }).toString()

  const source = game.actIdSource
  return `https://${source.host}${source.basePath}index.html?${query}`
}

/**
 * 获取通用 Luna 签到请求头
 */
function getLunaCommonHeaders(cookie, gameKey, game, actId = getCurrentActId(gameKey, game)) {
  return getHeaders(cookie, {
    ...SIGN_HEADERS,
    Referer: getLunaCommonReferer(gameKey, game, actId),
    Origin: 'https://webstatic.mihoyo.com',
  })
}

/** 使用候选 ACT_ID 查询通用 Luna 签到信息。 */
async function verifyActIdCandidate(cookie, gameKey, game, role, candidate) {
  const region = role.region || game.default_region
  const headers = getLunaCommonHeaders(cookie, gameKey, game, candidate)
  const query = new URLSearchParams({
    act_id: candidate,
    region,
    uid: role.game_uid,
    lang: 'zh-cn',
  }).toString()
  const response = await mysAxios.request({
    method: 'GET',
    headers,
    url: `${LUNA_INFO_URL}?${query}`,
  })
  const body = response?.data
  const valid =
    response.status >= 200 && response.status < 300 &&
    body?.retcode === 0 && body.data && typeof body.data === 'object' &&
    typeof body.data.is_sign === 'boolean'
  return { valid, isSigned: valid && body.data.is_sign }
}

/** 从米游社首页导航解析、只读验证 ACT_ID，并在确有必要时重试一次签到。 */
async function refreshAndRetrySignIn(cookie, gameKey, role, currentActId) {
  const game = getGameConfig(gameKey)
  const result = await refreshActIdAndRetry({
    gameKey,
    gameConfig: game,
    staleActId: currentActId,
    axiosInstance: mysAxios,
    userAgent: COMMON_HEADERS['User-Agent'],
    formatAxiosError,
    verifyCandidate: (candidate) => verifyActIdCandidate(cookie, gameKey, game, role, candidate),
    retrySignIn: () => signIn(cookie, gameKey, role, false),
  })
  return result.success
}

/**
 * 执行通用 Luna 签到
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

  const currentActId = getCurrentActId(gameKey, game)
  const headers = getLunaCommonHeaders(cookie, gameKey, game)

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
      url: LUNA_SIGN_URL,
    })

    const body = res?.data

    if (!body) {
      console.error(`[${game.name}] Sign-in failed: empty response`)
      return false
    }

    const message = body.message || 'Unknown'
    const retcode = body.retcode
    const captchaRequired = body.data?.success === 1

    if (
      !captchaRequired &&
      (
        message === 'OK' ||
        retcode === 0 ||
        /已签到|已经签到|签到过|今日已签到|already/i.test(message)
      )
    ) {
      console.log(
        `[${game.name}] <${role.nickname}(${maskUid(role.game_uid)})> Sign-in successful`
      )
      return true
    }

    if (captchaRequired) {
      console.error(
        `[${game.name}] <${role.nickname}(${maskUid(role.game_uid)})> Sign-in failed: captcha required`
      )
      return false
    }

    if (retryOnActIdInvalid && isActIdInvalid(body)) {
      console.warn(
        `[${game.name}] ACT_ID may be invalid, current ACT_ID=${currentActId}, trying to refresh...`
      )

      const retryOk = await refreshAndRetrySignIn(
        cookie,
        gameKey,
        role,
        currentActId
      )

      if (retryOk) {
        return true
      }

      console.warn(`[${game.name}] Retry after refreshing ACT_ID failed`)
    }

    console.error(
      `[${game.name}] <${role.nickname}(${maskUid(role.game_uid)})> Sign-in failed: retcode=${retcode}, message=${message}`
    )

    return false
  } catch (err) {
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

  const currentActId = getCurrentActId(gameKey, game)
  const headers = getLunaCommonHeaders(cookie, gameKey, game)

  const infoQuery = new URLSearchParams({
    act_id: currentActId,
    region,
    uid: role.game_uid,
    lang: 'zh-cn',
  }).toString()

  const homeQuery = new URLSearchParams({
    act_id: currentActId,
    lang: 'zh-cn',
  }).toString()

  try {
    const [infoRes, homeRes] = await Promise.all([
      mysAxios.request({
        method: 'GET',
        headers,
        url: `${LUNA_INFO_URL}?${infoQuery}`,
      }),
      mysAxios.request({
        method: 'GET',
        headers,
        url: `${LUNA_HOME_URL}?${homeQuery}`,
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
 * 通用 Luna 米游社签到入口
 */
async function doMYSCommonSign(gameKey) {
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

export { doMYSCommonSign }
