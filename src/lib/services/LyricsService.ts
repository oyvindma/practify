import { parsePlainLyrics, parseSyncedLyrics, type Lyrics } from '$lib/models/lyrics'

export interface LyricsQuery {
  trackName: string
  artistName: string
  albumName: string
  durationMs: number
}

export interface ILyricsService {
  getLyrics(query: LyricsQuery): Promise<Lyrics | null>
}

interface LrclibRecord {
  instrumental: boolean
  plainLyrics: string | null
  syncedLyrics: string | null
}

const LRCLIB_GET_URL = 'https://lrclib.net/api/get'

export class LrclibLyricsService implements ILyricsService {
  async getLyrics(query: LyricsQuery): Promise<Lyrics | null> {
    const params = new URLSearchParams({
      track_name: query.trackName,
      artist_name: query.artistName,
      album_name: query.albumName,
      duration: String(Math.round(query.durationMs / 1000)),
    })
    const response = await fetch(`${LRCLIB_GET_URL}?${params}`, {
      headers: { 'Lrclib-Client': 'Practify' },
    })
    if (response.status === 404) return null
    if (!response.ok) throw new Error(`LRCLIB responded with ${response.status}`)

    const record = (await response.json()) as LrclibRecord
    if (record.syncedLyrics) {
      return { synced: true, lines: parseSyncedLyrics(record.syncedLyrics) }
    }
    if (record.plainLyrics) {
      return { synced: false, lines: parsePlainLyrics(record.plainLyrics) }
    }
    return null
  }
}
