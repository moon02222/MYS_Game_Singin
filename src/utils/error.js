import { maskSensitive } from './mask.js'

/**
 * 安全格式化 axios 错误
 * 避免打印完整 err.config，因为其中可能包含 Cookie / Token
 */
export function formatAxiosError(err) {
  if (!err) return 'Unknown error'

  const data = err.response?.data

  return maskSensitive(
    JSON.stringify({
      status: err.response?.status,
      retcode: data?.retcode,
      message: data?.message || err.message || 'Unknown error',
    })
  )
}

