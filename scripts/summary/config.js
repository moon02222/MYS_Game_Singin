/**
 * 米游社任务列表
 */
export const MYS_TASKS = [
  { title: '崩坏学园2', label: '崩坏学园2-米游社' },
  { title: '崩坏3', label: '崩坏3-米游社' },
  { title: '未定事件簿', label: '未定事件簿-米游社' },
  { title: '原神', label: '原神-米游社' },
  { title: '崩坏：星穹铁道', label: '星穹铁道-米游社' },
  { title: '绝区零', label: '绝区零-米游社' },
]

/**
 * 云游戏任务列表
 * enabled 由环境变量控制
 */
export const CLOUD_TASKS = [
  { title: '云原神', label: '云原神', enabled: process.env.HAS_GENSHIN_TOKENS === 'true' },
  { title: '云崩铁', label: '云崩铁', enabled: process.env.HAS_STARRAIL_TOKENS === 'true' },
]