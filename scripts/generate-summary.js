/**
 * 生成邮件 HTML 总结
 *
 * 该脚本只负责读取 output.log 中的 Summary / Reward 行并生成 summary.html。
 * 不读取 Cookie、Token、SMTP 密码，也不负责发送邮件。
 * 邮件发送由 GitHub Actions 中的 nodemailer 脚本完成。
 */
import fs from 'node:fs'

const OUTPUT_LOG = 'output.log'
const SUMMARY_HTML = 'summary.html'

/**
 * 米游社任务列表
 */
const MYS_TASKS = [
  {
    title: '原神',
    label: '原神-米游社',
  },
  {
    title: '崩坏：星穹铁道',
    label: '星穹铁道-米游社',
  },
  {
    title: '绝区零',
    label: '绝区零-米游社',
  },
]

/**
 * 云游戏任务列表
 */
const CLOUD_TASKS = [
  {
    title: '云原神',
    label: '云原神',
    enabled: process.env.HAS_GENSHIN_TOKENS === 'true',
  },
  {
    title: '云崩铁',
    label: '云崩铁',
    enabled: process.env.HAS_STARRAIL_TOKENS === 'true',
  },
]

/**
 * HTML 转义
 */
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * 读取 output.log
 * 如果不存在，则返回空字符串，避免 workflow 前置步骤失败时这里再次失败
 */
function readOutputLog() {
  if (!fs.existsSync(OUTPUT_LOG)) {
    console.warn(`[Summary] ${OUTPUT_LOG} not found, create empty summary.`)
    return ''
  }

  return fs.readFileSync(OUTPUT_LOG, 'utf8')
}

/**
 * 获取北京时间
 */
function getBeijingTime() {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
    .format(new Date())
    .replace(/\//g, '-')
}

/**
 * 从 output.log 中提取某个任务最后一条 Summary 行
 */
function extractSummaryLine(output, label) {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`\\[${escapedLabel}\\] Summary:.*`, 'g')
  const matches = output.match(regex)

  if (!matches?.length) {
    return ''
  }

  return matches[matches.length - 1]
}

/**
 * 从 output.log 中提取某个任务的 Reward 行
 *
 * 示例：
 * [原神-米游社] Reward: {"user":1,"uid":"100****01","day":12,"name":"摩拉","cnt":5000,"icon":"https://xxx.png"}
 */
function extractRewardLines(output, label) {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`\\[${escapedLabel}\\] Reward:\\s*(\\{.*\\})`, 'g')

  const rewards = []

  for (const match of output.matchAll(regex)) {
    try {
      rewards.push(JSON.parse(match[1]))
    } catch {
      // 忽略解析失败的奖励日志
    }
  }

  return rewards
}

/**
 * 解析 Summary 行
 *
 * 示例：
 * [原神-米游社] Summary: total=1 failed=0 skipped=false success=true
 */
function parseSummaryLine(line) {
  if (!line) {
    return null
  }

  const match = line.match(
    /Summary:\s+total=(\d+)\s+failed=(\d+)\s+skipped=(true|false)\s+success=(true|false)/
  )

  if (!match) {
    return null
  }

  return {
    total: Number(match[1]),
    failed: Number(match[2]),
    skipped: match[3] === 'true',
    success: match[4] === 'true',
  }
}

/**
 * 根据 Summary 生成状态文本
 */
function renderStatus(summary) {
  if (!summary) {
    return '⚠️ 无记录'
  }

  if (summary.skipped) {
    return '⏭️ 已跳过'
  }

  if (summary.success) {
    return '✅ 成功'
  }

  if (summary.failed >= summary.total) {
    return '❌ 全部失败'
  }

  return '⚠️ 部分失败'
}

/**
 * 渲染累计天数
 */
function renderDayCell(rewards = []) {
  if (!rewards.length) {
    return '—'
  }

  return rewards
    .map((reward) => {
      const userPrefix = rewards.length > 1 && reward.user ? `账号${reward.user}：` : ''
      const day = reward.day ? `${reward.day}天` : '未知'

      return `
        <div style="margin: 2px 0; white-space: nowrap;">
          ${escapeHtml(userPrefix)}${escapeHtml(day)}
        </div>
      `
    })
    .join('')
}

/**
 * 渲染今日奖励
 */
function renderRewardCell(rewards = []) {
  if (!rewards.length) {
    return '—'
  }

  return rewards
    .map((reward) => {
      const userPrefix = rewards.length > 1 && reward.user ? `账号${reward.user}` : ''
      const name = reward.name || '未知奖励'
      const cnt = reward.cnt ? `×${reward.cnt}` : ''

      const icon = reward.icon
        ? `
          <img
            src="${escapeHtml(reward.icon)}"
            alt="${escapeHtml(name)}"
            style="width: 30px; height: 30px; display: block; margin: 0 auto 3px auto;"
          >
        `
        : ''

      return `
        <div style="display: inline-block; min-width: 48px; margin: 2px 4px; text-align: center; vertical-align: top;">
          ${userPrefix ? `<div style="font-size: 10px; line-height: 1.2; color: #666;">${escapeHtml(userPrefix)}</div>` : ''}
          ${icon}
          <div style="font-size: 11px; line-height: 1.25; word-break: keep-all;">
            ${escapeHtml(name)}
          </div>
          <div style="font-size: 11px; line-height: 1.25; color: #555;">
            ${escapeHtml(cnt)}
          </div>
        </div>
      `
    })
    .join('')
}

/**
 * 生成单行 HTML
 */
function renderRow(title, summary, rewards = []) {
  const status = renderStatus(summary)

  return `
    <tr>
      <td style="padding: 7px 5px; background-color: #f8f9fa; text-align: center; font-size: 12px;">
        ${escapeHtml(title)}
      </td>
      <td style="padding: 7px 5px; background-color: #f8f9fa; text-align: center; font-size: 12px; font-weight: bold; white-space: nowrap;">
        ${escapeHtml(status)}
      </td>
      <td style="padding: 7px 5px; background-color: #f8f9fa; text-align: center; font-size: 12px;">
        ${renderDayCell(rewards)}
      </td>
      <td style="padding: 7px 5px; background-color: #f8f9fa; text-align: center; font-size: 12px;">
        ${renderRewardCell(rewards)}
      </td>
    </tr>`
}

/**
 * 根据任务列表生成行
 *
 * 默认规则：
 * - skipped=true 的任务不展示
 * - 没有 Summary 的任务展示为“无记录”
 */
function buildRows(output, tasks) {
  return tasks
    .filter((task) => task.enabled !== false)
    .map((task) => {
      const line = extractSummaryLine(output, task.label)
      const summary = parseSummaryLine(line)
      const rewards = extractRewardLines(output, task.label)

      return {
        title: task.title,
        label: task.label,
        summary,
        rewards,
      }
    })
    .filter((item) => !item.summary?.skipped)
}

/**
 * 渲染一个结果区域
 */
function renderSection({ title, color, rows }) {
  if (!rows.length) {
    return ''
  }

  const body = rows
    .map((row) => renderRow(row.title, row.summary, row.rewards))
    .join('\n')

  return `
  <h3 style="color: ${color}; text-align: center; margin-top: 18px; margin-bottom: 8px; font-size: 16px;">
    ${escapeHtml(title)}
  </h3>

  <table border="1" cellpadding="0" cellspacing="0" style="border-collapse: collapse; width: 100%; border: 1px solid ${color}; table-layout: fixed; margin: 0 auto;">
    <thead>
      <tr style="background-color: ${color}; color: white;">
        <th style="padding: 7px 4px; text-align: center; width: 20%; font-size: 12px;">游戏</th>
        <th style="padding: 7px 4px; text-align: center; width: 22%; font-size: 12px;">签到结果</th>
        <th style="padding: 7px 4px; text-align: center; width: 22%; font-size: 12px;">累计天数</th>
        <th style="padding: 7px 4px; text-align: center; width: 36%; font-size: 12px;">今日奖励</th>
      </tr>
    </thead>
    <tbody>
      ${body}
    </tbody>
  </table>`
}

/**
 * 生成完整 HTML
 */
function renderHtml({ execTime, mysRows, cloudRows }) {
  const sections = [
    renderSection({
      title: '🏠 米游社签到',
      color: '#2e8b57',
      rows: mysRows,
    }),
    renderSection({
      title: '☁️ 云游戏签到',
      color: '#1e90ff',
      rows: cloudRows,
    }),
  ].filter(Boolean)

  const emptyMessage =
    sections.length === 0
      ? `
  <div style="padding: 14px; background-color: #f8f9fa; border: 1px solid #ddd; text-align: center; margin-top: 16px; font-size: 13px;">
    本次没有可显示的签到任务。
  </div>`
      : ''

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>米游社签到结果总结</title>
</head>
<body style="margin: 0; padding: 12px; font-family: Arial, Helvetica, sans-serif; color: #333;">
  <div style="max-width: 680px; margin: 0 auto;">
    <h2 style="color: #4a90e2; text-align: center; font-size: 18px; margin: 8px 0 10px;">
      📊 米游社签到结果总结
    </h2>

    <p style="text-align: center; font-size: 12px; margin: 0 0 12px;">
      <strong>🕒 执行时间：</strong> ${escapeHtml(execTime)}
    </p>

    ${sections.join('\n')}

    ${emptyMessage}

    <p style="text-align: center; margin-top: 16px; font-size: 11px; color: #777;">
      签到完成 · 感谢使用
    </p>
  </div>
</body>
</html>
`
}

/**
 * 主流程
 */
function main() {
  const output = readOutputLog()
  const execTime = getBeijingTime()

  const mysRows = buildRows(output, MYS_TASKS)
  const cloudRows = buildRows(output, CLOUD_TASKS)

  const html = renderHtml({
    execTime,
    mysRows,
    cloudRows,
  })

  fs.writeFileSync(SUMMARY_HTML, html, 'utf8')

  console.log(`[Summary] Generated ${SUMMARY_HTML}`)
  console.log(`[Summary] MYS rows: ${mysRows.length}`)
  console.log(`[Summary] Cloud rows: ${cloudRows.length}`)
}

main()
