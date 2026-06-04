/**
 * 米游社 act_id 失效判断工具
 *
 * 职责：
 * - 根据接口响应中的 retcode / message 判断 act_id 是否疑似失效
 *
 * 注意：
 * - 本文件只做“疑似判断”
 * - 不负责动态获取 act_id
 * - 不负责重试逻辑
 */

/**
 * 疑似 act_id 失效的 retcode 列表
 *
 * 说明：
 * - 米游社接口 retcode 可能会变化
 * - 后续如果遇到新的失效 retcode，可以在这里补充
 *
 * 注意：
 * - 不建议把 -100 放进这里
 * - -100 在米哈游接口里经常可能表示登录态 / Cookie 问题
 */
const INVALID_ACT_ID_RETCODES = new Set([
  -500001,
  1001,
  1002,
])

/**
 * 明显不是 act_id 失效的 retcode
 *
 * 这些情况不应该触发动态获取 act_id。
 */
const NOT_ACT_ID_RETCODES = new Set([
  0,
  -1,
  -100,
  -10001,
  -10002,
  -10003,
  -10004,
  -10005,
  -10006,
  -10007,
  -10008,
  1034,
])

/**
 * 判断 retcode 是否疑似 act_id 失效
 *
 * @param {number|string|undefined|null} retcode
 * @returns {boolean}
 */
function isInvalidRetcode(retcode) {
  if (retcode === undefined || retcode === null || retcode === '') {
    return false
  }

  const code = Number(retcode)

  if (Number.isNaN(code)) {
    return false
  }

  if (NOT_ACT_ID_RETCODES.has(code)) {
    return false
  }

  return INVALID_ACT_ID_RETCODES.has(code)
}

/**
 * 判断 message 是否明确不是 act_id 失效
 *
 * @param {string} message
 * @returns {boolean}
 */
function isClearlyNotActIdMessage(message) {
  const text = String(message || '').trim()

  if (!text) {
    return false
  }

  const patterns = [
    /OK/i,
    /已签到|已经签到|签到过|今日已签到|already/i,

    /**
     * 登录态 / 鉴权 / Cookie / Token
     */
    /登录|login|cookie|token|auth|鉴权|权限|未登录|登录失效|请重新登录/i,

    /**
     * 请求频率 / 风控 / 验证码
     */
    /频繁|too many|rate|风控|captcha|验证|risk/i,

    /**
     * 角色 / UID / 区服参数
     */
    /角色|uid|region|game_uid|game uid|区服/i,

    /**
     * DS / 签名 / 请求头问题
     */
    /DS|签名|signature|headers?|请求头/i,
  ]

  return patterns.some((pattern) => pattern.test(text))
}

/**
 * 判断 message 是否疑似 act_id 失效
 *
 * 这里尽量保守，避免把登录过期、角色不存在等问题误判成 act_id 失效。
 *
 * @param {string} message
 * @returns {boolean}
 */
function isInvalidMessage(message) {
  const text = String(message || '').trim()

  if (!text) {
    return false
  }

  if (isClearlyNotActIdMessage(text)) {
    return false
  }

  /**
   * 疑似 act_id 失效的关键词
   *
   * 说明：
   * - 避免使用过泛的 /不存在/、/过期/、/activity/i
   * - 尽量要求和“活动”或 act 相关
   */
  const invalidActIdPatterns = [
    /act_id/i,
    /act id/i,
    /活动.*不存在/,
    /活动.*已结束/,
    /活动.*过期/,
    /活动.*关闭/,
    /活动.*下线/,
    /活动.*未开启/,
    /活动.*无效/,
    /activity.*not found/i,
    /activity.*expired/i,
    /activity.*closed/i,
    /activity.*invalid/i,
    /invalid.*act/i,
    /invalid.*activity/i,
  ]

  return invalidActIdPatterns.some((pattern) => pattern.test(text))
}

/**
 * 从响应体中提取 retcode
 *
 * @param {object} body
 * @returns {*}
 */
function getRetcode(body) {
  return body?.retcode ?? body?.code ?? body?.status
}

/**
 * 从响应体中提取 message
 *
 * @param {object} body
 * @returns {string}
 */
function getMessage(body) {
  return body?.message ?? body?.msg ?? body?.error ?? body?.reason ?? ''
}

/**
 * 判断接口响应是否疑似 act_id 失效
 *
 * 支持传入：
 * - axios response data
 * - axios error.response.data
 * - 普通对象 { retcode, message }
 *
 * @param {object} body
 * @returns {boolean}
 */
export function isActIdInvalid(body) {
  if (!body || typeof body !== 'object') {
    return false
  }

  const retcode = getRetcode(body)
  const message = getMessage(body)

  return isInvalidRetcode(retcode) || isInvalidMessage(message)
}

/**
 * 获取 act_id 失效判断原因
 *
 * 这个函数不是必须使用。
 * 主要用于后续调试日志或扩展。
 *
 * @param {object} body
 * @returns {{ invalid: boolean, by: string, retcode: *, message: string }}
 */
export function getActIdInvalidReason(body) {
  if (!body || typeof body !== 'object') {
    return {
      invalid: false,
      by: '',
      retcode: undefined,
      message: '',
    }
  }

  const retcode = getRetcode(body)
  const message = getMessage(body)

  if (isInvalidRetcode(retcode)) {
    return {
      invalid: true,
      by: 'retcode',
      retcode,
      message,
    }
  }

  if (isInvalidMessage(message)) {
    return {
      invalid: true,
      by: 'message',
      retcode,
      message,
    }
  }

  return {
    invalid: false,
    by: '',
    retcode,
    message,
  }
}