import fs from 'node:fs'
import { MYS_TASKS, CLOUD_TASKS } from './config.js'
import { readOutputLog, buildRows } from './parser.js'
import { renderHtml, getMailTitle } from './renderer.js'

const SUMMARY_HTML = 'summary.html'
const SUMMARY_TITLE = 'summary-title.txt'

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

function main() {
  const output = readOutputLog()
  const execTime = getBeijingTime()

  const mysRows = buildRows(output, MYS_TASKS)
  const cloudRows = buildRows(output, CLOUD_TASKS)

  const html = renderHtml({ execTime, mysRows, cloudRows })
  const mailTitle = getMailTitle({ mysRows, cloudRows })

  fs.writeFileSync(SUMMARY_HTML, html, 'utf8')
  fs.writeFileSync(SUMMARY_TITLE, mailTitle, 'utf8')

  console.log(`[Summary] Generated ${SUMMARY_HTML}`)
  console.log(`[Summary] Generated ${SUMMARY_TITLE}: ${mailTitle}`)
  console.log(`[Summary] MYS rows: ${mysRows.length}`)
  console.log(`[Summary] Cloud rows: ${cloudRows.length}`)
}

main()