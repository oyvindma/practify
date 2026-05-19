import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getPlaylistTracks, getUserPlaylists, getCurrentUser } from '../api'

vi.mock('$lib/stores/authStore', () => ({
  authStore: { getValidToken: vi.fn().mockResolvedValue('test-token') },
}))

function mockFetch(data: unknown, ok = true) {
  vi.spyOn(global, 'fetch').mockResolvedValueOnce({
    ok,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as Response)
}

beforeEach(() => vi.clearAllMocks())

describe('getPlaylistTracks', () => {
  it('returns only SpotifyTrack items (filters out null items)', async () => {
    mockFetch({
      items: [
        { item: { id: '1', uri: 'spotify:track:1', name: 'Song', duration_ms: 3000, artists: [{ name: 'Artist' }], album: { name: 'Album', images: [] } } },
        { item: null },
      ],
      next: null,
    })
    const tracks = await getPlaylistTracks('playlist-1')
    expect(tracks).toHaveLength(1)
    expect(tracks[0].id).toBe('1')
  })

  it('filters out episode items (objects without album/artists)', async () => {
    mockFetch({
      items: [
        { item: { id: '1', uri: 'spotify:track:1', name: 'Song', duration_ms: 3000, artists: [{ name: 'Artist' }], album: { name: 'Album', images: [] } } },
        { item: { id: 'ep1', uri: 'spotify:episode:ep1', name: 'Episode', duration_ms: 1800_000 } }, // no album/artists
      ],
      next: null,
    })
    const tracks = await getPlaylistTracks('playlist-1')
    expect(tracks).toHaveLength(1)
    expect(tracks[0].id).toBe('1')
  })

  it('returns empty array when all items are null', async () => {
    mockFetch({ items: [{ item: null }, { item: null }], next: null })
    const tracks = await getPlaylistTracks('playlist-1')
    expect(tracks).toHaveLength(0)
  })

  it('throws on non-ok response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => JSON.stringify({ error: { message: 'Forbidden' } }),
    } as Response)
    await expect(getPlaylistTracks('playlist-1')).rejects.toThrow('Forbidden')
  })
})

describe('getUserPlaylists', () => {
  it('returns items array from response', async () => {
    mockFetch({
      items: [{ id: 'p1', name: 'My Playlist', images: [], items: { total: 10 } }],
      next: null,
    })
    const playlists = await getUserPlaylists()
    expect(playlists).toHaveLength(1)
    expect(playlists[0].id).toBe('p1')
  })

  it('throws on non-ok response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: { message: 'Unauthorized' } }),
    } as Response)
    await expect(getUserPlaylists()).rejects.toThrow('Unauthorized')
  })
})

describe('getCurrentUser', () => {
  it('returns user from response', async () => {
    mockFetch({ id: 'user123', display_name: 'Test User' })
    const user = await getCurrentUser()
    expect(user.id).toBe('user123')
    expect(user.display_name).toBe('Test User')
  })
})
