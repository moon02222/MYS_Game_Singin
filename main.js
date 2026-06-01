import { doMYSSign } from './src/MYS/index.js'
import { doCloudSign } from './src/MihoyoCloud/index.js'
import { maskSensitive } from './src/utils/index.js'

/**
 * 标准化任务返回值
 * 保证每个任务都返回 total / failed / skipped / success
 */
function normalizeResult(result = {}) {
  const total = Number(result.total ?? 0)
  const failed = Number(result.failed ?? 0)
  const skipped = Boolean(result.skipped)

  const success =
    typeof result.success === 'boolean'
      ? result.success
      : skipped || failed === 0

  return {
    total,
    failed,
    skipped,
    success,
  }
}

/**
 * 统一执行任务
 * 负责：
 * 1. 输出开始日志
 * 2. 捕获异常
 * 3. 输出标准 Summary 行，供 workflow 解析
 */
async function runTask(label, task) {
  console.log(`[${label}] 开始`)

  try {
    const result = normalizeResult(await task())

    console.log(
      `[${label}] Summary: total=${result.total} failed=${result.failed} skipped=${result.skipped} success=${result.success}`
    )

    return result
  } catch (error) {
    console.error(`[${label}] 未捕获异常: ${maskSensitive(error?.message || String(error))}`)

    const result = {
      total: 0,
      failed: 1,
      skipped: false,
      success: false,
    }

    console.log(
      `[${label}] Summary: total=${result.total} failed=${result.failed} skipped=${result.skipped} success=${result.success}`
    )

    return result
  }
}

/**
 * 主入口
 */
async function main() {
  const results = []

  // 米游社原神签到
  results.push(await runTask('原神-米游社', () => doMYSSign('Genshin')))

  // 米游社星穹铁道签到
  results.push(await runTask('星穹铁道-米游社', () => doMYSSign('StarRail')))

  // 米游社绝区零签到
  results.push(await runTask('绝区零-米游社', () => doMYSSign('ZZZ')))

  // 云原神签到
  results.push(await runTask('云原神', () => doCloudSign('CloudYS')))

  // 云崩铁签到
  results.push(await runTask('云崩铁', () => doCloudSign('CloudSR')))

  // 统计失败任务数
  const failedCount = results.filter((r) => !r.skipped && !r.success).length

  console.log(`[总计] 失败任务数: ${failedCount}`)

  // 如果有失败任务，让 GitHub Actions job 显示失败
  if (failedCount > 0) {
    process.exitCode = 1
  }
}

/**
 * 最外层兜底异常处理
 */
main().catch((error) => {
  console.error(`[主程序] 未捕获异常: ${maskSensitive(error?.message || String(error))}`)
  process.exitCode = 1
})
