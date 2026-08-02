/**
 * 米游社预支持游戏配置
 *
 * 注意：
 * - 这些游戏暂不加入 main.js 自动执行
 * - 参数未完全确认前不应作为正式签到任务
 */
export const MYS_PREVIEW_GAME_CONFIG = {
  HNA: {
    name: '崩坏：因缘精灵-米游社',
    title: '崩坏：因缘精灵',
    game_biz: 'abc_cn',
    signgame: 'hna',
    act_id: '',
    default_region: '',
    actPage: '',
    enabled: false,
    status: 'pending',
    note: 'game_biz 来自 setting.py；signgame 暂按 game_id2config 推测为 hna；act_id 和 actPage 待确认。',
  },
  StarNest: {
    name: '星布谷地-米游社',
    title: '星布谷地',
    game_biz: '',
    signgame: '',
    act_id: '',
    default_region: '',
    actPage: '',
    enabled: false,
    status: 'pending',
    note: '当前仅确认米游社分区 forumId=950；game_biz、signgame、act_id、actPage 待确认。',
  },
}

/**
 * 获取预支持游戏配置
 */
export function getPreviewGameConfig(gameKey) {
  const config = MYS_PREVIEW_GAME_CONFIG[gameKey]

  if (!config) {
    throw new Error(`Unsupported preview gameKey: ${gameKey}`)
  }

  return config
}

/**
 * 获取预支持游戏列表
 */
export function listPreviewGames() {
  return Object.values(MYS_PREVIEW_GAME_CONFIG)
}
