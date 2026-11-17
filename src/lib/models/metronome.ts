export const MIN_BPM = 30
export const MAX_BPM = 300

const MAX_TAPS_USED = 8

// Two decimals: rounding to whole BPM would drift the beat grid by seconds over a song
export function clampBpm(bpm: number): number {
  return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm * 100) / 100))
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

export function msUntilNextBeat(positionMs: number, anchorMs: number, bpm: number): number {
  const intervalMs = beatIntervalMs(bpm)
  const offsetMs = (((positionMs - anchorMs) % intervalMs) + intervalMs) % intervalMs
  return offsetMs === 0 ? 0 : intervalMs - offsetMs
}

export const MIN_SYNC_TAPS = 4
export const MAX_SYNC_TAPS = 8
const MIN_TAP_CONSISTENCY = 0.5

// Circular mean of where each tap falls within a beat, so taps spread over many beats agree
// and a wild tap barely moves the result. Null when there are too few or inconsistent taps.
export function estimateBeatOffsetMs(tapPositionsMs: number[], bpm: number): number | null {
  if (tapPositionsMs.length < MIN_SYNC_TAPS) return null
  const intervalMs = beatIntervalMs(bpm)
  let sine = 0
  let cosine = 0
  for (const positionMs of tapPositionsMs) {
    const angle = (positionMs / intervalMs) * 2 * Math.PI
    sine += Math.sin(angle)
    cosine += Math.cos(angle)
  }
  const consistency = Math.hypot(sine, cosine) / tapPositionsMs.length
  if (consistency < MIN_TAP_CONSISTENCY) return null
  const offsetMs = (Math.atan2(sine, cosine) / (2 * Math.PI)) * intervalMs
  return ((offsetMs % intervalMs) + intervalMs) % intervalMs
}

export function shiftBeatOffsetMs(offsetMs: number, deltaMs: number, bpm: number): number {
  const intervalMs = beatIntervalMs(bpm)
  return (((offsetMs + deltaMs) % intervalMs) + intervalMs) % intervalMs
}
