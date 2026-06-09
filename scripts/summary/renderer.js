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
 * 根据 Summary 生成状态文本
 */
function renderStatus(summary) {
  if (!summary) return '⚠️ 无记录'
  if (summary.skipped) return '⏭️ 已跳过'
  if (summary.success) return '✅ 成功'
  if (summary.failed >= summary.total) return '❌ 全部失败'
  return '⚠️ 部分失败'
}

/**
 * 获取状态徽章样式
 */
function getStatusBadgeStyle(statusText) {
  if (statusText.includes('成功')) {
    return 'background:#edf5e6;color:#4f6f35;border:1px solid #b8cf9d;'
  }

  if (statusText.includes('失败')) {
    return 'background:#f8e7df;color:#9b3f2f;border:1px solid #d8a28d;'
  }

  if (statusText.includes('跳过')) {
    return 'background:#f3ead6;color:#7b6a50;border:1px solid #d8c8a8;'
  }

  return 'background:#fbf3df;color:#7a5c35;border:1px solid #d6bd91;'
}

/**
 * 渲染状态徽章
 */
function renderStatusBadge(statusText) {
  return `
    <span style="display:inline-block;padding:3px 8px;border-radius:999px;font-size:11px;font-weight:bold;white-space:nowrap;${getStatusBadgeStyle(statusText)}">
      ${escapeHtml(statusText)}
    </span>
  `
}

/**
 * 获取报告标题信息
 */
function getReportTitleInfo(mysRows = [], cloudRows = []) {
  const hasMys = mysRows.length > 0
  const hasCloud = cloudRows.length > 0

  if (hasMys && hasCloud) {
    return {
      pageTitle: '米游社和云游戏签到结果总结',
      mainTitle: '📜 米游社和云游戏签到结果总结',
      sectionTitle: '📖 签到明细',
      mailTitle: '米游社和云游戏签到结果',
      sectionColor: '#4b5d3a',
    }
  }

  if (hasCloud) {
    return {
      pageTitle: '云游戏签到结果总结',
      mainTitle: '📜 云游戏签到结果总结',
      sectionTitle: '📖 云游戏签到明细',
      mailTitle: '云游戏签到结果',
      sectionColor: '#7a5c35',
    }
  }

  if (hasMys) {
    return {
      pageTitle: '米游社签到结果总结',
      mainTitle: '📜 米游社签到结果总结',
      sectionTitle: '📖 米游社签到明细',
      mailTitle: '米游社签到结果',
      sectionColor: '#4b5d3a',
    }
  }

  return {
    pageTitle: '签到结果总结',
    mainTitle: '📜 签到结果总结',
    sectionTitle: '📖 签到结果',
    mailTitle: '签到结果',
    sectionColor: '#4b5d3a',
  }
}

/**
 * 供 summary/index.js 写入邮件标题文件使用
 */
export function getMailTitle({ mysRows = [], cloudRows = [] }) {
  return getReportTitleInfo(mysRows, cloudRows).mailTitle
}

/**
 * 获取分组 key
 *
 * 优先 passportHash。
 * 没有 passportHash 时，使用来源 + user 序号，避免误合并。
 */
function getAccountGroupKey(item, source = 'user') {
  if (item?.passportHash) {
    return `passport:${item.passportHash}`
  }

  if (item?.user) {
    return `${source}:${item.user}`
  }

  return `${source}:unknown`
}

/**
 * 收集账号分组
 */
function collectAccountGroups(mysRows = [], cloudRows = []) {
  const groups = new Map()

  function addGroup(key, item, source) {
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        user: Number(item?.user || 0),
        passportHash: item?.passportHash || '',
        passportMasked: item?.passportMasked || '',
        source,
      })
    } else {
      const current = groups.get(key)

      if (!current.passportHash && item?.passportHash) {
        current.passportHash = item.passportHash
      }

      if (!current.passportMasked && item?.passportMasked) {
        current.passportMasked = item.passportMasked
      }

      if (!current.user && item?.user) {
        current.user = Number(item.user)
      }
    }
  }

  for (const row of mysRows) {
    for (const reward of row.rewards || []) {
      const key = getAccountGroupKey(reward, 'mys')
      addGroup(key, reward, 'mys')
    }
  }

  for (const row of cloudRows) {
    for (const reward of row.cloudRewards || []) {
      const key = getAccountGroupKey(reward, 'cloud')
      addGroup(key, reward, 'cloud')
    }
  }

  return [...groups.values()].sort((a, b) => {
    if (a.user && b.user) return a.user - b.user
    return String(a.key).localeCompare(String(b.key))
  })
}

/**
 * 获取账号显示名
 *
 * 优先显示米游社昵称。
 */
function getAccountDisplayName(group, mysRows = []) {
  for (const row of mysRows) {
    for (const reward of row.rewards || []) {
      const key = getAccountGroupKey(reward, 'mys')

      if (key === group.key && reward.mysNickname) {
        return reward.mysNickname
      }
    }
  }

  if (group.user) {
    return `账号${group.user}`
  }

  return '未知账号'
}

/**
 * 获取分组打码 ID
 */
function getGroupMaskedPassportId(group, mysRows = [], cloudRows = []) {
  if (group?.passportMasked) {
    return group.passportMasked
  }

  for (const row of mysRows) {
    for (const reward of row.rewards || []) {
      if (getAccountGroupKey(reward, 'mys') === group.key && reward.passportMasked) {
        return reward.passportMasked
      }
    }
  }

  for (const row of cloudRows) {
    for (const reward of row.cloudRewards || []) {
      if (getAccountGroupKey(reward, 'cloud') === group.key && reward.passportMasked) {
        return reward.passportMasked
      }
    }
  }

  return ''
}

/**
 * 查找指定账号分组的米游社结果
 */
function findMysReward(row, group) {
  return (row.rewards || []).find((reward) => {
    return getAccountGroupKey(reward, 'mys') === group.key
  })
}

/**
 * 查找指定账号分组的云游戏结果
 */
function findCloudReward(row, group) {
  return (row.cloudRewards || []).find((reward) => {
    return getAccountGroupKey(reward, 'cloud') === group.key
  })
}

/**
 * 计算任务统计
 *
 * 注意：
 * 当前 parser 会过滤 skipped 任务，所以这里不统计 skipped。
 */
function getTaskStats(mysRows = [], cloudRows = []) {
  const allRows = [...mysRows, ...cloudRows].filter((row) => row.summary)

  const total = allRows.length
  const success = allRows.filter((row) => row.summary?.success).length
  const failed = allRows.filter((row) => row.summary && !row.summary.success && !row.summary.skipped).length
  const mysSuccess = mysRows.filter((row) => row.summary?.success).length
  const cloudSuccess = cloudRows.filter((row) => row.summary?.success).length

  return {
    total,
    success,
    failed,
    mysSuccess,
    cloudSuccess,
  }
}

/**
 * 渲染统计卡片
 */
function renderStatsSection(mysRows = [], cloudRows = []) {
  const stats = getTaskStats(mysRows, cloudRows)

  if (!stats.total) return ''

  return `
    <div style="margin-top:14px;padding:12px;background:#f8efd9;border:1px solid #dfcda8;border-radius:13px;">
      <div style="font-size:13px;font-weight:bold;color:#5b4a32;text-align:center;margin-bottom:10px;">
        📌 本次任务统计
      </div>

      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;table-layout:fixed;">
        <tr>
          <td style="padding:5px;">
            <div style="background:#fffaf0;border:1px solid #d8c8a8;border-radius:10px;padding:10px 6px;text-align:center;">
              <div style="font-size:11px;color:#7b6a50;margin-bottom:4px;">总任务</div>
              <div style="font-size:20px;font-weight:bold;color:#4b3b27;">${stats.total}</div>
            </div>
          </td>

          <td style="padding:5px;">
            <div style="background:#edf5e6;border:1px solid #b8cf9d;border-radius:10px;padding:10px 6px;text-align:center;">
              <div style="font-size:11px;color:#4f6f35;margin-bottom:4px;">成功</div>
              <div style="font-size:20px;font-weight:bold;color:#4f6f35;">${stats.success}</div>
            </div>
          </td>

          <td style="padding:5px;">
            <div style="background:#f8e7df;border:1px solid #d8a28d;border-radius:10px;padding:10px 6px;text-align:center;">
              <div style="font-size:11px;color:#9b3f2f;margin-bottom:4px;">失败</div>
              <div style="font-size:20px;font-weight:bold;color:#9b3f2f;">${stats.failed}</div>
            </div>
          </td>
        </tr>
      </table>

      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;table-layout:fixed;margin-top:8px;">
        <tr>
          <td style="padding:5px;">
            <div style="background:#edf5e6;border:1px solid #b8cf9d;border-radius:10px;padding:8px 6px;text-align:center;">
              <span style="font-size:12px;color:#4f6f35;font-weight:bold;">🏠 米游社成功：${stats.mysSuccess}</span>
            </div>
          </td>

          <td style="padding:5px;">
            <div style="background:#f1e6d2;border:1px solid #d6bd91;border-radius:10px;padding:8px 6px;text-align:center;">
              <span style="font-size:12px;color:#7a5c35;font-weight:bold;">☁️ 云游戏成功：${stats.cloudSuccess}</span>
            </div>
          </td>
        </tr>
      </table>
    </div>
  `
}

/**
 * 渲染米游社奖励内容
 */
function renderMysRewardContent(reward) {
  if (!reward) return '—'

  const name = reward.name || '未知奖励'
  const cnt = reward.cnt ? `×${reward.cnt}` : ''
  const icon = reward.icon
    ? `<img src="${escapeHtml(reward.icon)}" alt="${escapeHtml(name)}" style="width:30px;height:30px;display:block;margin:0 auto 4px auto;">`
    : '<div style="font-size:24px;line-height:1;">🎁</div>'

  return `
    <div style="display:inline-block;min-width:58px;margin:3px 4px;padding:6px 5px;background:#fbf3df;border:1px solid #e2d2b2;border-radius:8px;text-align:center;vertical-align:top;">
      ${icon}
      <div style="font-size:11px;margin-top:4px;line-height:1.25;word-break:keep-all;">${escapeHtml(name)}</div>
      <div style="font-size:11px;color:#7b6a50;line-height:1.25;">${escapeHtml(cnt)}</div>
    </div>
  `
}

/**
 * 渲染账号下的米游社单行
 */
function renderAccountMysRow(row, group, index = 0) {
  const reward = findMysReward(row, group)
  const status = reward ? '✅ 成功' : renderStatus(row.summary)
  const day = reward?.day ? `${reward.day}天` : '—'
  const bg = index % 2 === 0 ? '#fffdf6' : '#fbf3df'

  return `
    <tr>
      <td style="padding:8px 5px;background:${bg};border-top:1px solid #e6d8bb;text-align:center;font-size:12px;">
        ${escapeHtml(row.title)}
      </td>
      <td style="padding:8px 5px;background:${bg};border-top:1px solid #e6d8bb;text-align:center;">
        ${renderStatusBadge(status)}
      </td>
      <td style="padding:8px 5px;background:${bg};border-top:1px solid #e6d8bb;text-align:center;font-size:12px;">
        ${escapeHtml(day)}
      </td>
      <td style="padding:8px 5px;background:${bg};border-top:1px solid #e6d8bb;text-align:center;font-size:12px;">
        ${renderMysRewardContent(reward)}
      </td>
    </tr>
  `
}

/**
 * 渲染账号下的云游戏单行
 */
function renderAccountCloudRow(row, group, index = 0) {
  const reward = findCloudReward(row, group)
  const status = reward ? '✅ 成功' : renderStatus(row.summary)
  const bg = index % 2 === 0 ? '#fffdf6' : '#fbf3df'

  /**
   * 云游戏网页展示的是免费时长。
   *
   * 优先使用 afterFreeTimeText：
   * - 来自 CloudReward.afterFreeTimeText
   * - 对应接口字段 data.free_time.free_time
   *
   * 兼容旧日志：
   * - 如果没有 afterFreeTimeText，才回退到 afterTotalTimeText
   */
  const afterTime =
    reward?.afterFreeTimeText ||
    reward?.afterTotalTimeText ||
    '—'

  const claimedTime = reward?.claimedTimeText || '—'

  return `
    <tr>
      <td style="padding:8px 5px;background:${bg};border-top:1px solid #e6d8bb;text-align:center;font-size:12px;">
        ${escapeHtml(row.title)}
      </td>
      <td style="padding:8px 5px;background:${bg};border-top:1px solid #e6d8bb;text-align:center;">
        ${renderStatusBadge(status)}
      </td>
      <td style="padding:8px 5px;background:${bg};border-top:1px solid #e6d8bb;text-align:center;font-size:12px;">
        ${escapeHtml(afterTime)}
      </td>
      <td style="padding:8px 5px;background:${bg};border-top:1px solid #e6d8bb;text-align:center;font-size:12px;">
        ${escapeHtml(claimedTime)}
      </td>
    </tr>
  `
}

/**
 * 渲染账号下的米游社结果表
 */
function renderAccountMysTable(rows = [], group) {
  const availableRows = rows.filter((row) => findMysReward(row, group))

  if (!availableRows.length) return ''

  const body = availableRows
    .map((row, index) => renderAccountMysRow(row, group, index))
    .join('\n')

  return `
    <div style="margin-top:12px;padding:8px 10px;background:#edf5e6;border:1px solid #b8cf9d;border-radius:9px;text-align:center;font-size:13px;font-weight:bold;color:#4f6f35;">
      🏠 米游社结果
    </div>

    <div style="margin-top:8px;background:#fffaf0;border:1px solid #7b9b5b;border-radius:9px;overflow:hidden;">
      <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;table-layout:fixed;">
        <thead>
          <tr style="background:#6f8d50;color:#fffaf0;">
            <th style="padding:8px 4px;text-align:center;width:22%;font-size:12px;">游戏</th>
            <th style="padding:8px 4px;text-align:center;width:22%;font-size:12px;">签到结果</th>
            <th style="padding:8px 4px;text-align:center;width:20%;font-size:12px;">累计天数</th>
            <th style="padding:8px 4px;text-align:center;width:36%;font-size:12px;">今日奖励</th>
          </tr>
        </thead>
        <tbody>
          ${body}
        </tbody>
      </table>
    </div>
  `
}

/**
 * 渲染账号下的云游戏结果表
 *
 * 列：
 * 游戏 | 签到结果 | 领取后免费时长 | 领取时长
 */
function renderAccountCloudTable(rows = [], group) {
  const availableRows = rows.filter((row) => findCloudReward(row, group))

  if (!availableRows.length) return ''

  const body = availableRows
    .map((row, index) => renderAccountCloudRow(row, group, index))
    .join('\n')

  return `
    <div style="margin-top:12px;padding:8px 10px;background:#f1e6d2;border:1px solid #d6bd91;border-radius:9px;text-align:center;font-size:13px;font-weight:bold;color:#7a5c35;">
      ☁️ 云游戏结果
    </div>

    <div style="margin-top:8px;background:#fffaf0;border:1px solid #9a7746;border-radius:9px;overflow:hidden;">
      <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;table-layout:fixed;">
        <thead>
          <tr style="background:#9a7746;color:#fffaf0;">
            <th style="padding:8px 4px;text-align:center;width:22%;font-size:12px;">游戏</th>
            <th style="padding:8px 4px;text-align:center;width:24%;font-size:12px;">签到结果</th>
            <th style="padding:8px 4px;text-align:center;width:27%;font-size:12px;">领取后免费时长</th>
            <th style="padding:8px 4px;text-align:center;width:27%;font-size:12px;">领取时长</th>
          </tr>
        </thead>
        <tbody>
          ${body}
        </tbody>
      </table>
    </div>
  `
}

/**
 * 渲染单个账号区块
 */
function renderAccountBlock(group, mysRows = [], cloudRows = []) {
  const accountName = getAccountDisplayName(group, mysRows)
  const maskedPassportId = getGroupMaskedPassportId(group, mysRows, cloudRows)

  return `
    <div style="margin-top:16px;padding:12px;border:1px solid #d7c7a8;border-radius:14px;background:#fffdf6;">
      <div style="padding:10px 12px;background:#fffaf0;border:1px solid #e0d0af;border-radius:11px;text-align:center;">
        <div style="font-size:16px;font-weight:bold;color:#3f3528;">
          ${escapeHtml(accountName)}
        </div>

        ${
          maskedPassportId
            ? `<div style="font-size:11px;color:#8a7656;margin-top:4px;">
                id: ${escapeHtml(maskedPassportId)}
              </div>`
            : ''
        }
      </div>

      ${renderAccountMysTable(mysRows, group)}
      ${renderAccountCloudTable(cloudRows, group)}
    </div>
  `
}

/**
 * 渲染按账号分组区域
 */
function renderGroupedAccountSection({ mysRows, cloudRows, titleInfo }) {
  const groups = collectAccountGroups(mysRows, cloudRows)

  if (!groups.length) return ''

  const body = groups
    .map((group) => renderAccountBlock(group, mysRows, cloudRows))
    .join('\n')

  return `
    <h3 style="color:${titleInfo.sectionColor};text-align:center;margin:20px 0 10px;font-size:16px;">
      ${escapeHtml(titleInfo.sectionTitle)}
    </h3>
    ${body}
  `
}

/**
 * 生成完整 HTML
 */
export function renderHtml({ execTime, mysRows, cloudRows }) {
  const titleInfo = getReportTitleInfo(mysRows, cloudRows)
  const statsSection = renderStatsSection(mysRows, cloudRows)
  const groupedSection = renderGroupedAccountSection({ mysRows, cloudRows, titleInfo })

  const emptyMessage = !groupedSection && !statsSection
    ? `<div style="padding:14px;background:#fbf3df;border:1px solid #e2d2b2;text-align:center;margin-top:16px;font-size:13px;border-radius:10px;color:#6b583c;">本次没有可显示的签到任务。</div>`
    : ''

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(titleInfo.pageTitle)}</title>
</head>
<body style="margin:0;padding:16px;background:#f4efe3;font-family:Arial,'Microsoft YaHei','PingFang SC',sans-serif;color:#3f3528;">
  <div style="max-width:720px;margin:0 auto;background:#fffaf0;border:1px solid #d8c8a8;border-radius:16px;padding:18px;box-shadow:0 4px 14px rgba(91,70,43,.10);">

    <div style="background:#4b5d3a;background:linear-gradient(135deg,#4b5d3a,#7a5c35);border-radius:13px;padding:16px 12px;text-align:center;color:#fffaf0;">
      <div style="font-size:19px;font-weight:bold;line-height:1.4;letter-spacing:.5px;">
        ${escapeHtml(titleInfo.mainTitle)}
      </div>
      <div style="font-size:12px;margin-top:6px;color:#f4ead8;">
        一日签到已毕 · 今日收获如下
      </div>
    </div>

    <div style="margin-top:14px;padding:10px 12px;background:#fbf3df;border:1px solid #e2d2b2;border-radius:10px;text-align:center;font-size:12px;color:#6b583c;">
      <strong>🕯️ 签到时间：</strong> ${escapeHtml(execTime)}
    </div>

    ${statsSection}
    ${groupedSection}
    ${emptyMessage}

    <p style="text-align:center;margin-top:18px;font-size:11px;color:#8a7656;">
      今日事已成 · 愿君皆顺遂
    </p>
  </div>
</body>
</html>`
}
