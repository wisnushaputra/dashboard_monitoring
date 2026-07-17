import { exec } from 'child_process'

export interface PingResult {
  alive: boolean
  latencyMs: number | null
}

export function ping(ip: string): Promise<PingResult> {
  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32'
    const cmd = isWindows
      ? `ping -n 1 -w 3000 ${ip}`
      : `ping -c 1 -W 3 ${ip}`

    const start = Date.now()
    exec(cmd, (error, stdout) => {
      const elapsed = Date.now() - start

      if (error) {
        resolve({ alive: false, latencyMs: null })
        return
      }

      const match = stdout.match(/time[=<]\s*(\d+(?:\.\d+)?)\s*ms/i)
      if (match) {
        resolve({ alive: true, latencyMs: parseFloat(match[1]) })
      } else if (stdout.includes('time') || stdout.includes('ttl')) {
        resolve({ alive: true, latencyMs: elapsed })
      } else {
        resolve({ alive: false, latencyMs: null })
      }
    })
  })
}
