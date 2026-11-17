export interface IBpmStorageService {
  getBpm(trackId: string): number | null
  saveBpm(trackId: string, bpm: number): void
  getBeatOffsetMs(trackId: string): number | null
  saveBeatOffsetMs(trackId: string, offsetMs: number): void
  clearBeatOffsetMs(trackId: string): void
}

function buildStorageKey(trackId: string): string {
  return `bpm_${trackId}`
}

function buildBeatOffsetKey(trackId: string): string {
  return `beatoffset_${trackId}`
}

function readPositiveNumber(key: string, allowZero = false): number | null {
  const raw = localStorage.getItem(key)
  if (raw === null) return null
  const value = Number(raw)
  const isValid = Number.isFinite(value) && (allowZero ? value >= 0 : value > 0)
  return isValid ? value : null
}

function writeNumber(key: string, value: number): void {
  try {
    localStorage.setItem(key, String(value))
  } catch {
    // Storage full or unavailable: the value still works for this session
  }
}

export class BpmStorageService implements IBpmStorageService {
  getBpm(trackId: string): number | null {
    return readPositiveNumber(buildStorageKey(trackId))
  }

  saveBpm(trackId: string, bpm: number): void {
    writeNumber(buildStorageKey(trackId), bpm)
  }

  getBeatOffsetMs(trackId: string): number | null {
    return readPositiveNumber(buildBeatOffsetKey(trackId), true)
  }

  saveBeatOffsetMs(trackId: string, offsetMs: number): void {
    writeNumber(buildBeatOffsetKey(trackId), offsetMs)
  }

  clearBeatOffsetMs(trackId: string): void {
    localStorage.removeItem(buildBeatOffsetKey(trackId))
  }
}
