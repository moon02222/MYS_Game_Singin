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
 * 渲染米游社奖励内容
 */
function renderMysRewardContent(reward) {
  if (!reward) return '—'

  const name = reward.name || '未知奖励'
  const cnt = reward.cnt ? `×${reward.cnt}` : ''
  const icon = reward.icon
    ? `<img src="${escapeHtml(reward.icon)}" alt="${escapeHtml(name)}" style="width: 30px; height: 30px; display: block; margin: 0 auto 3px auto;">`
    : ''

  return `
    <div style="display: inline-block; min-width: 48px; margin: 2px 4px; text-align: center; vertical-align: top;">
      ${icon}
      <div style="font-size: 11px; line-height: 1.25; word-break: keep-all;">${escapeHtml(name)}</div>
      <div style="font-size: 11px; line-height: 1.25; color: #555;">${escapeHtml(cnt)}</div>
    </div>
  `
}

/**
 * 渲染账号下的米游社单行
 */
function renderAccountMysRow(row, group) {
  const reward = findMysReward(row, group)
  const status = reward ? '✅ 成功' : renderStatus(row.summary)
  const day = reward?.day ? `${reward.day}天` : '—'

  return `
    <tr>
      <td style="padding: 7px 5px; background-color: #f8f9fa; text-align: center; font-size: 12px;">
        ${escapeHtml(row.title)}
      </td>
      <td style="padding: 7px 5px; background-color: #f8f9fa; text-align: center; font-size: 12px; font-weight: bold; white-space: nowrap;">
        ${escapeHtml(status)}
      </td>
      <td style="padding: 7px 5px; background-color: #f8f9fa; text-align: center; font-size: 12px;">
        ${escapeHtml(day)}
      </td>
      <td style="padding: 7px 5px; background-color: #f8f9fa; text-align: center; font-size: 12px;">
        ${renderMysRewardContent(reward)}
      </td>
    </tr>
  `
}

/**
 * 渲染账号下的云游戏单行
 */
function renderAccountCloudRow(row, group) {
  const reward = findCloudReward(row, group)
  const status = reward ? '✅ 成功' : renderStatus(row.summary)
  const afterTime = reward?.afterFreeTimeText || '—'
  const claimedTime = reward?.claimedTimeText || '—'

  return `
    <tr>
      <td style="padding: 7px 5px; background-color: #f8f9fa; text-align: center; font-size: 12px;">
        ${escapeHtml(row.title)}
      </td>
      <td style="padding: 7px 5px; background-color: #f8f9fa; text-align: center; font-size: 12px; font-weight: bold; white-space: nowrap;">
        ${escapeHtml(status)}
      </td>
      <td style="padding: 7px 5px; background-color: #f8f9fa; text-align: center; font-size: 12px;">
        ${escapeHtml(afterTime)}
      </td>
      <td style="padding: 7px 5px; background-color: #f8f9fa; text-align: center; font-size: 12px;">
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
    .map((row) => renderAccountMysRow(row, group))
    .join('\n')

  return `
    <div style="font-size: 13px; font-weight: bold; color: #2e8b57; text-align: center; margin: 8px 0 5px;">
      米游社结果
    </div>
    <table border="1" cellpadding="0" cellspacing="0" style="border-collapse: collapse; width: 100%; border: 1px solid #2e8b57; table-layout: fixed; margin: 0 auto 10px;">
      <thead>
        <tr style="background-color: #2e8b57; color: white;">
          <th style="padding: 7px 4px; text-align: center; width: 20%; font-size: 12px;">游戏</th>
          <th style="padding: 7px 4px; text-align: center; width: 22%; font-size: 12px;">签到结果</th>
          <th style="padding: 7px 4px; text-align: center; width: 22%; font-size: 12px;">累计天数</th>
          <th style="padding: 7px 4px; text-align: center; width: 36%; font-size: 12px;">今日奖励</th>
        </tr>
      </thead>
      <tbody>
        ${body}
      </tbody>
    </table>
  `
}

/**
 * 渲染账号下的云游戏结果表
 *
 * 列：
 * 游戏 | 签到结果 | 领取后时长 | 领取时长
 */
function renderAccountCloudTable(rows = [], group) {
  const availableRows = rows.filter((row) => findCloudReward(row, group))

  if (!availableRows.length) return ''

  const body = availableRows
    .map((row) => renderAccountCloudRow(row, group))
    .join('\n')

  return `
    <div style="font-size: 13px; font-weight: bold; color: #1e90ff; text-align: center; margin: 8px 0 5px;">
      云游戏结果
    </div>
    <table border="1" cellpadding="0" cellspacing="0" style="border-collapse: collapse; width: 100%; border: 1px solid #1e90ff; table-layout: fixed; margin: 0 auto 14px;">
      <thead>
        <tr style="background-color: #1e90ff; color: white;">
          <th style="padding: 7px 4px; text-align: center; width: 22%; font-size: 12px;">游戏</th>
          <th style="padding: 7px 4px; text-align: center; width: 24%; font-size: 12px;">签到结果</th>
          <th style="padding: 7px 4px; text-align: center; width: 27%; font-size: 12px;">领取后时长</th>
          <th style="padding: 7px 4px; text-align: center; width: 27%; font-size: 12px;">领取时长</th>
        </tr>
      </thead>
      <tbody>
        ${body}
      </tbody>
    </table>
  `
}

/**
 * 渲染单个账号区块
 */
function renderAccountBlock(group, mysRows = [], cloudRows = []) {
  const accountName = getAccountDisplayName(group, mysRows)
  const maskedPassportId = getGroupMaskedPassportId(group, mysRows, cloudRows)

  return `
    <div style="margin-top: 16px; padding-top: 8px; border-top: 1px dashed #ddd;">
      <div style="text-align: center; font-size: 15px; font-weight: bold; color: #333; margin: 4px 0 3px;">
        ${escapeHtml(accountName)}
      </div>

      ${
        maskedPassportId
          ? `<div style="text-align: center; font-size: 11px; color: #777; margin: 0 0 10px;">
              id: ${escapeHtml(maskedPassportId)}
            </div>`
          : ''
      }

      ${renderAccountMysTable(mysRows, group)}
      ${renderAccountCloudTable(cloudRows, group)}
    </div>
  `
}

/**
 * 渲染按账号分组区域
 */
function renderGroupedAccountSection({ mysRows, cloudRows }) {
  const groups = collectAccountGroups(mysRows, cloudRows)

  if (!groups.length) return ''

  const body = groups
    .map((group) => renderAccountBlock(group, mysRows, cloudRows))
    .join('\n')

  return `
    <h3 style="color: #2e8b57; text-align: center; margin-top: 18px; margin-bottom: 8px; font-size: 16px;">
      🏠 米游社签到
    </h3>
    ${body}
  `
}

/**
 * 生成完整 HTML
 */
export function renderHtml({ execTime, mysRows, cloudRows }) {
  const groupedSection = renderGroupedAccountSection({ mysRows, cloudRows })

  const emptyMessage = !groupedSection
    ? `<div style="padding: 14px; background-color: #f8f9fa; border: 1px solid #ddd; text-align: center; margin-top: 16px; font-size: 13px;">本次没有可显示的签到任务。</div>`
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
    ${groupedSection}
    ${emptyMessage}
    <p style="text-align: center; margin-top: 16px; font-size: 11px; color: #777;">
      签到完成 · 感谢使用
    </p>
  </div>
</body>
</html>`
}