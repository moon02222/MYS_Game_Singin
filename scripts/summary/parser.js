import fs from 'node:fs'

const OUTPUT_LOG = 'output.log'

/**
 * 正则转义
 */
function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 读取 output.log
 * 如果不存在，返回空字符串，避免前置步骤失败时这里再次失败
 */
export function readOutputLog() {
  if (!fs.existsSync(OUTPUT_LOG)) {
    console.warn(`[Summary] ${OUTPUT_LOG} not found, create empty summary.`)
    return ''
  }

  return fs.readFileSync(OUTPUT_LOG, 'utf8')
}

/**
 * 提取某个任务最后一条 Summary 行
 */
export function extractSummaryLine(output, label) {
  const escapedLabel = escapeRegExp(label)
  const regex = new RegExp(`\\[${escapedLabel}\\] Summary:.*`, 'g')
  const matches = output.match(regex)

  if (!matches?.length) return ''

  return matches[matches.length - 1]
}

/**
 * 提取米游社 Reward 行
 */
export function extractRewardLines(output, label) {
  const escapedLabel = escapeRegExp(label)
  const regex = new RegExp(`\\[${escapedLabel}\\] Reward:\\s*(\\{.*\\})`, 'g')
  const rewards = []

  for (const match of output.matchAll(regex)) {
    try {
      rewards.push(JSON.parse(match[1]))
    } catch {
      // 忽略解析失败
    }
  }

  return rewards
}

/**
 * 提取云游戏 CloudReward 行
 */
export function extractCloudRewardLines(output, label) {
  const escapedLabel = escapeRegExp(label)
  const regex = new RegExp(`\\[${escapedLabel}\\] CloudReward:\\s*(\\{.*\\})`, 'g')
  const cloudRewards = []

  for (const match of output.matchAll(regex)) {
    try {
      cloudRewards.push(JSON.parse(match[1]))
    } catch {
      // 忽略解析失败
    }
  }

  return cloudRewards
}

/**
 * 解析 Summary 行
 */
export function parseSummaryLine(line) {
  if (!line) return null

  const match = line.match(
    /Summary:\s+total=(\d+)\s+failed=(\d+)\s+skipped=(true|false)\s+success=(true|false)/
  )

  if (!match) return null

  return {
    total: Number(match[1]),
    failed: Number(match[2]),
    skipped: match[3] === 'true',
    success: match[4] === 'true',
  }
}

/**
 * 根据任务列表构建渲染行数据
 */
export function buildRows(output, tasks) {
  return tasks
    .filter((task) => task.enabled !== false)
    .map((task) => {
      const line = extractSummaryLine(output, task.label)
      const summary = parseSummaryLine(line)
      const rewards = extractRewardLines(output, task.label)
      const cloudRewards = extractCloudRewardLines(output, task.label)

      return {
        title: task.title,
        label: task.label,
        summary,
        rewards,
        cloudRewards,
      }
    })
    .filter((item) => !item.summary?.skipped)
}