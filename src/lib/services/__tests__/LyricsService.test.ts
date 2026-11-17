import { describe, it, expect, vi, afterEach } from 'vitest'
import { LrclibLyricsService } from '../LyricsService'

const query = { trackName: 'Song', artistName: 'Band', albumName: 'Album', durationMs: 200_400 }

function stubFetch(status: number, body: unknown = {}) {
  const fetchMock = vi.fn().mockResolvedValue({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => vi.unstubAllGlobals())

describe('LrclibLyricsService', () => {
  it('queries by track signature with duration in seconds', async () => {
    const fetchMock = stubFetch(404)
    await new LrclibLyricsService().getLyrics(query)
    const url = new URL(fetchMock.mock.calls[0][0])
    expect(url.searchParams.get('track_name')).toBe('Song')
    expect(url.searchParams.get('artist_name')).toBe('Band')
    expect(url.searchParams.get('album_name')).toBe('Album')
    expect(url.searchParams.get('duration')).toBe('200')
  })

  it('prefers synced lyrics', async () => {
    stubFetch(200, { plainLyrics: 'x', syncedLyrics: '[00:01.00] x', instrumental: false })
    const lyrics = await new LrclibLyricsService().getLyrics(query)
    expect(lyrics).toEqual({ synced: true, lines: [{ startMs: 1000, text: 'x' }] })
  })

  it('falls back to plain lyrics', async () => {
    stubFetch(200, { plainLyrics: 'x', syncedLyrics: null, instrumental: false })
    const lyrics = await new LrclibLyricsService().getLyrics(query)
    expect(lyrics).toEqual({ synced: false, lines: [{ startMs: null, text: 'x' }] })
  })

  it('returns null for instrumental tracks and 404', async () => {
    stubFetch(200, { plainLyrics: null, syncedLyrics: null, instrumental: true })
    expect(await new LrclibLyricsService().getLyrics(query)).toBeNull()
    stubFetch(404)
    expect(await new LrclibLyricsService().getLyrics(query)).toBeNull()
  })

  it('throws on other errors', async () => {
    stubFetch(429)
    await expect(new LrclibLyricsService().getLyrics(query)).rejects.toThrow('429')
  })
})
