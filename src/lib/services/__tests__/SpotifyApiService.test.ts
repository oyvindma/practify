import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SpotifyApiService } from '../SpotifyApiService'

const api = new SpotifyApiService(async () => 'test-token')

function mockFetch(data: unknown, ok = true) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
    ok,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as Response)
}

beforeEach(() => vi.restoreAllMocks())

describe('getPlaylistTracks', () => {
  it('returns only SpotifyTrack items (filters out null items)', async () => {
    mockFetch({
      items: [
        {
          item: {
            id: '1',
            uri: 'spotify:track:1',
            name: 'Song',
            duration_ms: 3000,
            artists: [{ name: 'Artist' }],
            album: { name: 'Album', images: [] },
          },
        },
        { item: null },
      ],
      next: null,
    })
    const tracks = await api.getPlaylistTracks('playlist-1')
    expect(tracks).toHaveLength(1)
    expect(tracks[0].id).toBe('1')
  })

  it('filters out episode items (objects without album/artists)', async () => {
    mockFetch({
      items: [
        {
          item: {
            id: '1',
            uri: 'spotify:track:1',
            name: 'Song',
            duration_ms: 3000,
            artists: [{ name: 'Artist' }],
            album: { name: 'Album', images: [] },
          },
        },
        { item: { id: 'ep1', uri: 'spotify:episode:ep1', name: 'Episode', duration_ms: 1800_000 } }, // no album/artists
      ],
      next: null,
    })
    const tracks = await api.getPlaylistTracks('playlist-1')
    expect(tracks).toHaveLength(1)
    expect(tracks[0].id).toBe('1')
  })

  it('returns empty array when all items are null', async () => {
    mockFetch({ items: [{ item: null }, { item: null }], next: null })
    const tracks = await api.getPlaylistTracks('playlist-1')
    expect(tracks).toHaveLength(0)
  })

  it('throws on non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => JSON.stringify({ error: { message: 'Forbidden' } }),
    } as Response)
    await expect(api.getPlaylistTracks('playlist-1')).rejects.toThrow('Forbidden')
  })
})

describe('getUserPlaylists', () => {
  it('returns items array from response', async () => {
    mockFetch({
      items: [{ id: 'p1', name: 'My Playlist', images: [], items: { total: 10 } }],
      next: null,
    })
    const playlists = await api.getUserPlaylists()
    expect(playlists).toHaveLength(1)
    expect(playlists[0].id).toBe('p1')
  })

  it('throws on non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: { message: 'Unauthorized' } }),
    } as Response)
    await expect(api.getUserPlaylists()).rejects.toThrow('Unauthorized')
  })
})

describe('getCurrentUser', () => {
  it('returns user from response', async () => {
    mockFetch({ id: 'user123', display_name: 'Test User' })
    const user = await api.getCurrentUser()
    expect(user.id).toBe('user123')
    expect(user.display_name).toBe('Test User')
  })
})

describe('authentication', () => {
  it('rejects without calling fetch when there is no access token', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const unauthenticatedApi = new SpotifyApiService(async () => null)
    await expect(unauthenticatedApi.getCurrentUser()).rejects.toThrow('Not authenticated')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('sends the access token as a bearer header', async () => {
    mockFetch({ id: 'u', display_name: 'U' })
    await api.getCurrentUser()
    const [, init] = vi.mocked(fetch).mock.calls[0]
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer test-token')
  })
})

describe('startPlayback', () => {
  it('puts the track uri to the player endpoint for the device', async () => {
    mockFetch({})
    await api.startPlayback('device-1', 'spotify:track:1')
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(String(url)).toContain('/me/player/play?device_id=device-1')
    expect(init?.method).toBe('PUT')
    expect(JSON.parse(init?.body as string)).toEqual({ uris: ['spotify:track:1'] })
  })

  it('throws the api error message on failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => JSON.stringify({ error: { message: 'No device' } }),
    } as Response)
    await expect(api.startPlayback('device-1', 'spotify:track:1')).rejects.toThrow('No device')
  })
})

describe('pagination', () => {
  const BASE = 'https://api.spotify.com/v1'
  const playlist = (id: string) => ({ id, name: id, images: [], items: { total: 1 } })
  const trackItem = (id: string) => ({
    item: {
      id,
      uri: `spotify:track:${id}`,
      name: id,
      duration_ms: 1000,
      artists: [{ name: 'A' }],
      album: { name: 'Al', images: [] },
    },
  })

  it('follows next links and concatenates playlists', async () => {
    mockFetch({ items: [playlist('p1')], next: `${BASE}/me/playlists?offset=50&limit=50` })
    mockFetch({ items: [playlist('p2')], next: `${BASE}/me/playlists?offset=100&limit=50` })
    mockFetch({ items: [playlist('p3')], next: null })
    const playlists = await api.getUserPlaylists()
    expect(playlists.map((p) => p.id)).toEqual(['p1', 'p2', 'p3'])
    expect(vi.mocked(fetch).mock.calls.map(([url]) => String(url))).toEqual([
      `${BASE}/me/playlists?limit=50`,
      `${BASE}/me/playlists?offset=50&limit=50`,
      `${BASE}/me/playlists?offset=100&limit=50`,
    ])
  })

  it('follows next links for playlist tracks and still filters non-tracks', async () => {
    mockFetch({
      items: [trackItem('t1'), { item: null }],
      next: `${BASE}/playlists/x/items?offset=100&limit=100`,
    })
    mockFetch({ items: [trackItem('t2')], next: null })
    const tracks = await api.getPlaylistTracks('x')
    expect(tracks.map((t) => t.id)).toEqual(['t1', 't2'])
  })

  it('never follows a next link that points to another host', async () => {
    mockFetch({ items: [playlist('p1')], next: 'https://evil.example/steal?token=1' })
    const playlists = await api.getUserPlaylists()
    expect(playlists).toHaveLength(1)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('stops after a maximum number of pages', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        ({
          ok: true,
          json: async () => ({ items: [playlist('p')], next: `${BASE}/me/playlists?again` }),
        }) as Response,
    )
    const playlists = await api.getUserPlaylists()
    expect(playlists).toHaveLength(50)
  })

  it('propagates an error from a later page', async () => {
    mockFetch({ items: [playlist('p1')], next: `${BASE}/me/playlists?offset=50` })
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => JSON.stringify({ error: { message: 'Rate limited' } }),
    } as Response)
    await expect(api.getUserPlaylists()).rejects.toThrow('Rate limited')
  })
})
