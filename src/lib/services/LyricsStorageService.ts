import type { Lyrics } from '$lib/models/lyrics'

export interface ILyricsStorageService {
  getLyrics(trackId: string): Lyrics | null
  saveLyrics(trackId: string, lyrics: Lyrics): void
}

function buildStorageKey(trackId: string): string {
  return `lyrics_${trackId}`
}

export class LyricsStorageService implements ILyricsStorageService {
  getLyrics(trackId: string): Lyrics | null {
    const rawJson = localStorage.getItem(buildStorageKey(trackId))
    if (!rawJson) return null
    try {
      return JSON.parse(rawJson) as Lyrics
    } catch {
      return null
    }
  }

  saveLyrics(trackId: string, lyrics: Lyrics): void {
    try {
      localStorage.setItem(buildStorageKey(trackId), JSON.stringify(lyrics))
    } catch {
      // Storage full or unavailable: the lyrics are still shown, just not cached
    }
  }
}
