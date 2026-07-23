export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged'
  text: string
  oldLineNumber?: number
  newLineNumber?: number
}

export function computeLineDiff(oldText: string, newText: string): { diffs: DiffLine[]; addedCount: number; removedCount: number } {
  const oldLines = oldText ? oldText.split(/\r?\n/) : []
  const newLines = newText ? newText.split(/\r?\n/) : []

  const diffs: DiffLine[] = []
  let addedCount = 0
  let removedCount = 0

  // Simple Myers / LCS line diff algorithm
  const n = oldLines.length
  const m = newLines.length

  let i = 0
  let j = 0

  // Use a map/set based matching for line diffs
  while (i < n || j < m) {
    if (i < n && j < m && oldLines[i] === newLines[j]) {
      diffs.push({
        type: 'unchanged',
        text: oldLines[i],
        oldLineNumber: i + 1,
        newLineNumber: j + 1,
      })
      i++
      j++
    } else {
      // Look ahead to see if oldLines[i] matches a future line in newLines
      let nextNewMatch = -1
      for (let k = j + 1; k < Math.min(m, j + 10); k++) {
        if (i < n && oldLines[i] === newLines[k]) {
          nextNewMatch = k
          break
        }
      }

      let nextOldMatch = -1
      for (let k = i + 1; k < Math.min(n, i + 10); k++) {
        if (j < m && oldLines[k] === newLines[j]) {
          nextOldMatch = k
          break
        }
      }

      if (nextNewMatch !== -1 && (nextOldMatch === -1 || nextNewMatch - j <= nextOldMatch - i)) {
        while (j < nextNewMatch) {
          diffs.push({
            type: 'added',
            text: newLines[j],
            newLineNumber: j + 1,
          })
          addedCount++
          j++
        }
      } else if (nextOldMatch !== -1) {
        while (i < nextOldMatch) {
          diffs.push({
            type: 'removed',
            text: oldLines[i],
            oldLineNumber: i + 1,
          })
          removedCount++
          i++
        }
      } else {
        if (i < n) {
          diffs.push({
            type: 'removed',
            text: oldLines[i],
            oldLineNumber: i + 1,
          })
          removedCount++
          i++
        }
        if (j < m) {
          diffs.push({
            type: 'added',
            text: newLines[j],
            newLineNumber: j + 1,
          })
          addedCount++
          j++
        }
      }
    }
  }

  return { diffs, addedCount, removedCount }
}
