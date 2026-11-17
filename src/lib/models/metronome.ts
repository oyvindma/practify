export const MIN_BPM = 30
export const MAX_BPM = 300

const MAX_TAPS_USED = 8

export function clampBpm(bpm: number): number {
  return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)))
}

export function beatIntervalMs(bpm: number): number {
  return 60_000 / bpm
}

export function bpmFromTaps(tapTimestampsMs: number[]): number | null {
  const recentTaps = tapTimestampsMs.slice(-MAX_TAPS_USED)
  if (recentTaps.length < 2) return null
  const averageIntervalMs = (recentTaps.at(-1)! - recentTaps[0]) / (recentTaps.length - 1)
  if (averageIntervalMs <= 0) return null
  return clampBpm(60_000 / averageIntervalMs)
}
