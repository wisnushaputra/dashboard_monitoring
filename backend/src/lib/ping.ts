import { exec } from 'child_process'

export interface PingResult {
  alive: boolean
  latencyMs: number | null
  packetLoss: number
  minLatency: number | null
  maxLatency: number | null
  avgLatency: number | null
}

export function ping(ip: string, count = 4): Promise<PingResult> {
  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32'
    const cmd = isWindows
      ? `ping -n ${count} -w 2000 ${ip}`
      : `ping -c ${count} -W 2 ${ip}`

    const start = Date.now()
    exec(cmd, (error, stdout) => {
      if (error && !stdout.includes('ttl') && !stdout.includes('time=')) {
        resolve({ alive: false, latencyMs: null, packetLoss: 100, minLatency: null, maxLatency: null, avgLatency: null })
        return
      }

      const lossMatch = stdout.match(/(\d+(?:\.\d+)?)%\s*(packet\s+)?loss/i)
      const packetLoss = lossMatch ? parseFloat(lossMatch[1]) : 100

      const times = [...stdout.matchAll(/time[=<]\s*(\d+(?:\.\d+)?)\s*ms/gi)].map(m => parseFloat(m[1]))
      const alive = times.length > 0 && packetLoss < 100
      const minLatency = times.length > 0 ? Math.min(...times) : null
      const maxLatency = times.length > 0 ? Math.max(...times) : null
      const avgLatency = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : null

      resolve({
        alive,
        latencyMs: avgLatency,
        packetLoss,
        minLatency,
        maxLatency,
        avgLatency,
      })
    })
  })
}

export function pingFast(ip: string): Promise<PingResult> {
  return new Promise((resolve) => {
    const cmd = process.platform === 'win32'
      ? `ping -n 1 -w 3000 ${ip}`
      : `ping -c 1 -W 3 ${ip}`

    exec(cmd, (error, stdout) => {
      const lossMatch = stdout.match(/(\d+(?:\.\d+)?)%\s*(packet\s+)?loss/i)
      const packetLoss = lossMatch ? parseFloat(lossMatch[1]) : (error ? 100 : 0)

      const times = [...stdout.matchAll(/time[=<]\s*(\d+(?:\.\d+)?)\s*ms/gi)].map(m => parseFloat(m[1]))
      const alive = times.length > 0

      resolve({
        alive,
        latencyMs: times[0] || null,
        packetLoss,
        minLatency: times[0] || null,
        maxLatency: times[0] || null,
        avgLatency: times[0] || null,
      })
    })
  })
}
