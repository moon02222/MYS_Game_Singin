import axios from 'axios'
import md5 from 'md5'
import { v4 as uuidv4 } from 'uuid'
import {
  parseCookieList,
  maskUid,
  formatAxiosError,
  getSafePassportInfo,
  hashPassportId,
} from '../utils/index.js'

/**
 * 米游社接口主机
 */
export const WEB_HOST = 'api-takumi.mihoyo.com'

/**
 * 米游社用户信息接口主机
 */
export const BBS_HOST = 'bbs-api.miyoushe.com'

/**
 * 模拟米游社 App 版本
 */
export const APP_VERSION = '2.81.1'

/**
 * 设备 ID
 */
export const DEVICE_ID = process.env.MYS_DEVICE_ID || uuidv4()

/**
 * axios 实例
 */
export const mysAxios = axios.create({
  timeout: 15000,
})

/**
 * Cookie 列表缓存
 */
let COOKIE_LIST_CACHE = null

/**
 * 米游社账号信息缓存
 */
const MYS_ACCOUNT_INFO_CACHE = new Map()

/**
 * 公共请求头
 */
export const COMMON_HEADERS = {
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
export const ROLE_HEADERS = {
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
export const SIGN_HEADERS = {
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
 * 读取 MYS_COOKIES
 */
export function getCookieList() {
  if (COOKIE_LIST_CACHE) {
    return COOKIE_LIST_CACHE
  }

  const mysCookies = process.env.MYS_COOKIES

  if (!mysCookies) {
    console.info('[米游社] No MYS_COOKIES configured, skip MYS tasks.')
    COOKIE_LIST_CACHE = []
    return COOKIE_LIST_CACHE
  }

  COOKIE_LIST_CACHE = parseCookieList(mysCookies)

  return COOKIE_LIST_CACHE
}

/**
 * 获取 Cookie 缓存 key
 */
export function getCookieCacheKey(cookie) {
  const safeInfo = getSafePassportInfo(cookie)

  if (safeInfo.passportHash) {
    return `passport:${safeInfo.passportHash}`
  }

  const cookieHash = hashPassportId(String(cookie || ''))

  return cookieHash
    ? `cookie:${cookieHash}`
    : 'cookie:unknown'
}

/**
 * 生成米游社 DS
 */
export function getDS() {
  const salt = 'yUZ3s0Sna1IrSNfk29Vo6vRapdOyqyhB'
  const t = Math.floor(Date.now() / 1e3)
  const r = Math.random().toString(36).slice(-6)
  const c = `salt=${salt}&t=${t}&r=${r}`

  return `${t},${r},${md5(c)}`
}

/**
 * 组合请求头
 */
export function getHeaders(cookie, whichHeader) {
  return {
    ...COMMON_HEADERS,
    ...whichHeader,
    Cookie: cookie,
    DS: getDS(),
  }
}

/**
 * 判断是否还有下一个账号
 */
export function hasNextItem(index, list = []) {
  return index < list.length - 1
}

/**
 * 获取账号绑定角色
 */
export async function getRole(cookie, gameConfig) {
  const headers = getHeaders(cookie, ROLE_HEADERS)

  try {
    const res = await mysAxios.request({
      method: 'GET',
      headers,
      url: `https://${WEB_HOST}/binding/api/getUserGameRolesByCookie?game_biz=${gameConfig.game_biz}`,
    })

    const data = res?.data

    if (!data) {
      console.error(`[${gameConfig.name}] Login failed: empty response`)
      return {
        status: 'failed',
        role: null,
      }
    }

    if (data.retcode !== 0) {
      console.error(`[${gameConfig.name}] Login failed: retcode=${data.retcode}, message=${data.message}`)
      return {
        status: 'failed',
        role: null,
      }
    }

    const role = data.data?.list?.[0]

    if (!role?.game_uid) {
      console.info(`[${gameConfig.name}] No character found, skip this account`)
      return {
        status: 'no_role',
        role: null,
      }
    }

    console.log(
      `[${gameConfig.name}] Login successful <${role.nickname}(${maskUid(role.game_uid)})>`
    )

    return {
      status: 'ok',
      role,
    }
  } catch (err) {
    console.error(`[${gameConfig.name}] Login error: ${formatAxiosError(err)}`)
    return {
      status: 'failed',
      role: null,
    }
  }
}

/**
 * 获取米游社账号信息
 */
export async function getMYSAccountInfo(cookie, gameConfig) {
  const fallbackSafeInfo = getSafePassportInfo(cookie)
  const cacheKey = getCookieCacheKey(cookie)

  if (MYS_ACCOUNT_INFO_CACHE.has(cacheKey)) {
    return MYS_ACCOUNT_INFO_CACHE.get(cacheKey)
  }

  try {
    const res = await mysAxios.request({
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
        console.log(`[${gameConfig.name}] MYS account nickname fetched`)
      }

      const result = {
        mysNickname,
        passportHash: safeInfoFromResponse.passportHash || fallbackSafeInfo.passportHash,
        passportMasked: safeInfoFromResponse.passportMasked || fallbackSafeInfo.passportMasked,
      }

      MYS_ACCOUNT_INFO_CACHE.set(cacheKey, result)

      return result
    }

    console.warn(
      `[${gameConfig.name}] Get MYS account info failed: retcode=${data?.retcode}, message=${data?.message}`
    )

    const result = {
      mysNickname: '',
      ...fallbackSafeInfo,
    }

    MYS_ACCOUNT_INFO_CACHE.set(cacheKey, result)

    return result
  } catch (err) {
    console.warn(`[${gameConfig.name}] Get MYS account info error: ${formatAxiosError(err)}`)

    const result = {
      mysNickname: '',
      ...fallbackSafeInfo,
    }

    MYS_ACCOUNT_INFO_CACHE.set(cacheKey, result)

    return result
  }
}

/**
 * 输出奖励日志，供邮件摘要解析
 */
export function logReward(gameName, cookieIndex, role, reward, accountInfo = {}) {
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