export interface IBpmStorageService {
  getBpm(trackId: string): number | null
  saveBpm(trackId: string, bpm: number): void
}

function buildStorageKey(trackId: string): string {
  return `bpm_${trackId}`
}

export class BpmStorageService implements IBpmStorageService {
  getBpm(trackId: string): number | null {
    const raw = localStorage.getItem(buildStorageKey(trackId))
    if (raw === null) return null
    const bpm = Number(raw)
    return Number.isFinite(bpm) && bpm > 0 ? bpm : null
  }

  saveBpm(trackId: string, bpm: number): void {
    try {
      localStorage.setItem(buildStorageKey(trackId), String(bpm))
    } catch {
      // Storage full or unavailable: the bpm still works for this session
    }
  }
}
