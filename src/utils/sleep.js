/**
 * 随机等待
 */
export function randomSleep(min, max) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min
  console.log(`Sleeping for ${delay} seconds...`)
  return new Promise((resolve) => setTimeout(resolve, delay * 1000))
}

