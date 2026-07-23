interface Sample {
  latencyMs: number
  jitterMs: number
  timestamp: number
}

interface NodeBuffer {
  samples: Sample[]
}

const nodeBuffers = new Map<number, NodeBuffer>()
const MAX_SAMPLES = 30 // Keep last 30 ping check samples (~2.5 minutes)

export interface AnomalyDetectionResult {
  isAnomaly: boolean
  type?: 'latency_spike' | 'slow_degradation' | 'jitter_anomaly'
  severity?: 'warning' | 'critical'
  zScore: number
  baselineAvg: number
  currentValue: number
  message?: string
}

export function detectNodeAnomalies(
  nodeId: number,
  currentLatency: number | null,
  currentJitter: number | null
): AnomalyDetectionResult {
  if (currentLatency === null || currentLatency <= 0) {
    return { isAnomaly: false, zScore: 0, baselineAvg: 0, currentValue: 0 }
  }

  const jitterVal = currentJitter || 0
  const buffer = nodeBuffers.get(nodeId) || { samples: [] }

  // Add sample to sliding buffer
  buffer.samples.push({ latencyMs: currentLatency, jitterMs: jitterVal, timestamp: Date.now() })
  if (buffer.samples.length > MAX_SAMPLES) {
    buffer.samples.shift()
  }

  nodeBuffers.set(nodeId, buffer)

  // We need at least 5 baseline samples to compute meaningful statistics
  if (buffer.samples.length < 5) {
    return { isAnomaly: false, zScore: 0, baselineAvg: currentLatency, currentValue: currentLatency }
  }

  // Calculate baseline mean and standard deviation from previous samples (excluding latest)
  const prevSamples = buffer.samples.slice(0, buffer.samples.length - 1)
  const latencies = prevSamples.map(s => s.latencyMs)
  const n = latencies.length
  const mean = latencies.reduce((a, b) => a + b, 0) / n

  const variance = latencies.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n
  const stdDev = Math.sqrt(variance)

  // Calculate Z-Score
  // To avoid divide-by-zero when variance is 0, set minimum stdDev threshold (e.g. 1.0 ms)
  const effectiveStdDev = Math.max(stdDev, 1.0)
  const zScore = (currentLatency - mean) / effectiveStdDev

  // Check 1: Latency Spike (Z >= 3.0 or Z >= 2.2 for warning)
  if (zScore >= 3.0 && currentLatency > mean + 15) {
    return {
      isAnomaly: true,
      type: 'latency_spike',
      severity: 'critical',
      zScore: parseFloat(zScore.toFixed(2)),
      baselineAvg: parseFloat(mean.toFixed(1)),
      currentValue: parseFloat(currentLatency.toFixed(1)),
      message: `AI Alert: Critical latency spike detected! (Z-Score: ${zScore.toFixed(2)}, Current: ${currentLatency.toFixed(1)}ms vs Baseline: ${mean.toFixed(1)}ms)`,
    }
  } else if (zScore >= 2.2 && currentLatency > mean + 10) {
    return {
      isAnomaly: true,
      type: 'latency_spike',
      severity: 'warning',
      zScore: parseFloat(zScore.toFixed(2)),
      baselineAvg: parseFloat(mean.toFixed(1)),
      currentValue: parseFloat(currentLatency.toFixed(1)),
      message: `AI Alert: Moderate latency anomaly detected (Z-Score: ${zScore.toFixed(2)}, Baseline: ${mean.toFixed(1)}ms)`,
    }
  }

  // Check 2: Slow Degradation (4+ consecutive increasing samples, current > 25% above baseline mean)
  if (buffer.samples.length >= 5) {
    const recent = buffer.samples.slice(-4)
    let isMonotonicIncreasing = true
    for (let i = 1; i < recent.length; i++) {
      if (recent[i].latencyMs <= recent[i - 1].latencyMs) {
        isMonotonicIncreasing = false
        break
      }
    }

    if (isMonotonicIncreasing && currentLatency >= mean * 1.25 && currentLatency - mean >= 8) {
      return {
        isAnomaly: true,
        type: 'slow_degradation',
        severity: 'warning',
        zScore: parseFloat(zScore.toFixed(2)),
        baselineAvg: parseFloat(mean.toFixed(1)),
        currentValue: parseFloat(currentLatency.toFixed(1)),
        message: `AI Warning: Slow performance degradation detected! Latency creeping up over consecutive checks (+${((currentLatency - mean) / mean * 100).toFixed(0)}% increase)`,
      }
    }
  }

  return {
    isAnomaly: false,
    zScore: parseFloat(zScore.toFixed(2)),
    baselineAvg: parseFloat(mean.toFixed(1)),
    currentValue: parseFloat(currentLatency.toFixed(1)),
  }
}
