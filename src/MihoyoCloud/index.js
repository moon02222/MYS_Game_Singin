import axios from 'axios'
import { v4 as uuidv4 } from 'uuid'
import {
  randomSleep,
  parseTokenList,
  maskSensitive,
  formatAxiosError,
  getSafePassportInfo,
} from '../utils/index.js'

/**
 * 云游戏设备 ID
 * 推荐在 GitHub Secrets 中配置 MIHOYO_DEVICE_ID 或 MIHOYO_CLOUD_DEVICE_ID
 */
const DEVICE_ID =
  process.env.MIHOYO_DEVICE_ID ||
  process.env.MIHOYO_CLOUD_DEVICE_ID ||
  uuidv4()

/**
 * axios 实例
 */
const $axios = axios.create({
  timeout: 15000,
})

/**
 * 读取云游戏 Token 配置
 */
function getTokenConfig() {
  const genshinTokens = process.env.GENSHIN_TOKENS
  const starRailTokens = process.env.STARRAIL_TOKENS

  if (!genshinTokens && !starRailTokens) {
    console.info('[云游戏] No cloud game tokens configured, skip cloud tasks.')
    return { CloudYS: [], CloudSR: [] }
  }

  return {
    CloudYS: parseTokenList(genshinTokens),
    CloudSR: parseTokenList(starRailTokens),
  }
}

/**
 * 云游戏公共请求头
 */
const commonHeaders = {
  Connection: 'Keep-Alive',
  'Accept-Encoding': 'gzip, deflate, br, zstd',
  'accept-language': 'zh-CN,zh;q=0.9',
  Accept: 'application/json, text/plain, */*',
  'sec-ch-ua': `"Chromium";v="140", "Not=A?Brand";v="24", "Google Chrome";v="140"`,
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': `"macOS"`,
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-site',
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  'x-rpc-channel': 'mihoyo',
  'x-rpc-client_type': 17,
  'x-rpc-combo_token': '',
  'x-rpc-cps': 'mac_mihoyo',
  'x-rpc-device_id': DEVICE_ID,
  'x-rpc-device_model': 'Macintosh',
  'x-rpc-device_name': 'Apple Macintosh',
  'x-rpc-language': 'zh-cn',
  'x-rpc-sys_version': 'Mac OS 10.15.7',
  'x-rpc-vendor_id': 2,
}

/**
 * 云游戏接口配置
 */
const gameConfig = {
  CloudYS: {
    name: '云原神',
    headers: {
      Host: 'api-cloudgame.mihoyo.com',
      origin: 'https://ys.mihoyo.com',
      Referer: 'https://ys.mihoyo.com/',
      'x-rpc-app_id': 4,
      'x-rpc-app_version': '6.0.0',
      'x-rpc-cg_game_biz': 'hk4e_cn',
      'x-rpc-op_biz': 'clgm_cn',
    },
    baseURL: 'https://api-cloudgame.mihoyo.com/hk4e_cg_cn',
  },
  CloudSR: {
    name: '云崩铁',
    headers: {
      Host: 'cg-hkrpg-api.mihoyo.com',
      origin: 'https://sr.mihoyo.com',
      Referer: 'https://sr.mihoyo.com/',
      'x-rpc-app_id': 8,
      'x-rpc-app_version': '3.5.0',
      'x-rpc-cg_game_biz': 'hkrpg_cn',
      'x-rpc-op_biz': 'clgm_hkrpg-cn',
    },
    baseURL: 'https://cg-hkrpg-api.mihoyo.com/hkrpg_cn/cg',
  },
}

/**
 * 获取游戏配置
 */
function getGameConfig(gameKey) {
  const config = gameConfig[gameKey]

  if (!config) {
    throw new Error(`Unsupported gameKey: ${gameKey}`)
  }

  return config
}

/**
 * 统一请求封装
 */
async function requestWithToken(gameKey, token, options) {
  const config = getGameConfig(gameKey)

  return $axios.request({
    ...options,
    headers: {
      ...commonHeaders,
      ...config.headers,
      ...(options.headers || {}),
      'x-rpc-combo_token': token,
    },
  })
}

/**
 * 格式化云游戏时长
 *
 * 云游戏接口里的时长通常是秒。
 */
function formatCloudTime(seconds) {
  const value = Number(seconds || 0)

  if (!Number.isFinite(value) || value <= 0) {
    return '0分钟'
  }

  if (value < 60) {
    return `${Math.floor(value)}秒`
  }

  const totalMinutes = Math.floor(value / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours > 0 && minutes > 0) {
    return `${hours}小时${minutes}分钟`
  }

  if (hours > 0) {
    return `${hours}小时`
  }

  return `${minutes}分钟`
}

/**
 * 查询钱包信息
 *
 * 返回结构：
 * {
 *   ok: boolean,
 *   freeTime: number,
 *   totalTime: number,
 *   freeTimeText: string,
 *   totalTimeText: string
 * }
 */
async function getWallet(gameKey, token) {
  const config = getGameConfig(gameKey)

  try {
    const res = await requestWithToken(gameKey, token, {
      method: 'GET',
      url: `${config.baseURL}/wallet/wallet/get`,
    })

    const walletData = res?.data?.data
    const freeTime = Number(walletData?.free_time?.free_time ?? 0)
    const totalTime = Number(walletData?.total_time ?? 0)

    if (res?.data?.message === 'OK' && walletData?.free_time) {
      console.log(
        `[${config.name}] Get wallet success! free_time: ${freeTime} (${formatCloudTime(freeTime)}), total_time: ${totalTime} (${formatCloudTime(totalTime)})`
      )

      return {
        ok: true,
        freeTime,
        totalTime,
        freeTimeText: formatCloudTime(freeTime),
        totalTimeText: formatCloudTime(totalTime),
      }
    }

    console.error(
      `[${config.name}] Get wallet failed: ${maskSensitive(
        JSON.stringify({
          retcode: res?.data?.retcode,
          message: res?.data?.message,
        })
      )}`
    )

    return {
      ok: false,
      freeTime: 0,
      totalTime: 0,
      freeTimeText: '0分钟',
      totalTimeText: '0分钟',
    }
  } catch (err) {
    console.error(`[${config.name}] Get wallet error: ${formatAxiosError(err)}`)

    return {
      ok: false,
      freeTime: 0,
      totalTime: 0,
      freeTimeText: '0分钟',
      totalTimeText: '0分钟',
    }
  }
}

/**
 * 查询未读弹窗通知
 *
 * 返回结构：
 * {
 *   ok: boolean,
 *   list: Array
 * }
 */
async function getNotifications(gameKey, token) {
  const config = getGameConfig(gameKey)

  try {
    const res = await requestWithToken(gameKey, token, {
      method: 'GET',
      url: `${config.baseURL}/gamer/api/listNotifications?status=NotificationStatusUnread&type=NotificationTypePopup&is_sort=true`,
    })

    if (res?.data?.message === 'OK' && Array.isArray(res.data.data?.list)) {
      const list = res.data.data.list

      console.log(`[${config.name}] Get notifications success! count: ${list.length}`)

      return {
        ok: true,
        list,
      }
    }

    console.error(
      `[${config.name}] Get notifications failed: ${maskSensitive(
        JSON.stringify({
          retcode: res?.data?.retcode,
          message: res?.data?.message,
        })
      )}`
    )

    return {
      ok: false,
      list: [],
    }
  } catch (err) {
    console.error(`[${config.name}] Get notifications error: ${formatAxiosError(err)}`)

    return {
      ok: false,
      list: [],
    }
  }
}

/**
 * 确认通知
 */
async function ackNotifications(gameKey, token, id) {
  const config = getGameConfig(gameKey)

  try {
    const res = await requestWithToken(gameKey, token, {
      method: 'POST',
      url: `${config.baseURL}/gamer/api/ackNotification`,
      data: { id },
    })

    if (res?.data?.message === 'OK') {
      console.log(`[${config.name}] ACK notification success! id: ${id}`)
      return true
    }

    console.error(
      `[${config.name}] ACK notification failed: ${maskSensitive(
        JSON.stringify({
          id,
          retcode: res?.data?.retcode,
          message: res?.data?.message,
        })
      )}`
    )

    return false
  } catch (err) {
    console.error(`[${config.name}] ACK notification error: ${formatAxiosError(err)}`)
    return false
  }
}

/**
 * 输出云游戏时长结果日志，供邮件摘要解析
 *
 * 注意：
 * - 不输出完整通行证 ID
 * - passportHash 用于同账号匹配
 * - passportMasked 用于邮件展示
 */
function logCloudReward(gameName, tokenIndex, token, beforeWallet, afterWallet, claimedTime) {
  const safePassportInfo = getSafePassportInfo(token)

  console.log(
    `[${gameName}] CloudReward: ${JSON.stringify({
      user: tokenIndex + 1,
      passportHash: safePassportInfo.passportHash,
      passportMasked: safePassportInfo.passportMasked,
      beforeFreeTime: beforeWallet.freeTime,
      afterFreeTime: afterWallet.freeTime,
      claimedTime,
      beforeFreeTimeText: beforeWallet.freeTimeText,
      afterFreeTimeText: afterWallet.freeTimeText,
      claimedTimeText: formatCloudTime(claimedTime),
    })}`
  )
}

/**
 * 云游戏签到入口
 */
async function doCloudSign(gameKey) {
  const config = getGameConfig(gameKey)
  const CONF = getTokenConfig()
  const tokenList = CONF[gameKey] || []

  if (!tokenList.length) {
    console.info(`[${config.name}] Skip: no token configured`)

    return {
      gameKey,
      total: 0,
      failed: 0,
      skipped: true,
      success: true,
    }
  }

  console.info(`[${config.name}] Start signing in, total ${tokenList.length} users\n`)

  let failed = 0

  for (const [tokenIndex, token] of tokenList.entries()) {
    if (!token) continue

    console.log(`[${config.name}] User ${tokenIndex + 1} starts signing in...`)

    let userFailed = false

    /**
     * 领取前查询钱包
     */
    const beforeWallet = await getWallet(gameKey, token)

    if (!beforeWallet.ok) {
      userFailed = true
    }

    /**
     * 查询未读通知
     */
    const notificationsResult = await getNotifications(gameKey, token)

    let afterWallet = beforeWallet

    if (!notificationsResult.ok) {
      userFailed = true
    } else if (notificationsResult.list.length) {
      for (const notification of notificationsResult.list) {
        await randomSleep(1, 3)

        const ok = await ackNotifications(gameKey, token, notification.id)

        if (!ok) {
          userFailed = true
        }
      }

      /**
       * ACK 后再次查询钱包
       */
      afterWallet = await getWallet(gameKey, token)

      if (!afterWallet.ok) {
        userFailed = true
      }
    } else {
      console.log(`[${config.name}] No unread notifications`)
    }

    /**
     * 计算领取时长
     */
    const claimedTime =
      beforeWallet.ok && afterWallet.ok
        ? Math.max(0, afterWallet.freeTime - beforeWallet.freeTime)
        : 0

    console.log(
      `[${config.name}] User ${tokenIndex + 1} cloud time result: before=${beforeWallet.freeTimeText}, after=${afterWallet.freeTimeText}, claimed=${formatCloudTime(claimedTime)}`
    )

    logCloudReward(config.name, tokenIndex, token, beforeWallet, afterWallet, claimedTime)

    if (userFailed) {
      failed++
    }

    await randomSleep(3, 9)
  }

  console.info(`[${config.name}] Sign-in completed\n`)

  return {
    gameKey,
    total: tokenList.length,
    failed,
    skipped: false,
    success: failed === 0,
  }
}

export { doCloudSign }