import type { SpotifyPlaylist, SpotifyTrack, SpotifyUser } from '$lib/models/spotify'

const BASE_URL = 'https://api.spotify.com/v1'
const MAX_PAGES = 50

export type AccessTokenProvider = () => Promise<string | null>

export interface ISpotifyApiService {
  getCurrentUser(): Promise<SpotifyUser>
  getUserPlaylists(): Promise<SpotifyPlaylist[]>
  getPlaylistTracks(playlistId: string): Promise<SpotifyTrack[]>
  startPlayback(deviceId: string, trackUri: string): Promise<void>
}

interface PlaylistsResponse {
  items: SpotifyPlaylist[]
  next: string | null
}

interface PlaylistItem {
  item: SpotifyTrack | null
  episode?: unknown
}

interface PlaylistTracksResponse {
  items: PlaylistItem[]
  next: string | null
}

async function extractErrorMessage(response: Response): Promise<string> {
  const body = await response.text()
  const fallback = `HTTP ${response.status}`
  try {
    return JSON.parse(body)?.error?.message ?? fallback
  } catch {
    return body || fallback
  }
}

function isTrack(item: unknown): item is SpotifyTrack {
  return item != null && typeof item === 'object' && 'album' in item && 'artists' in item
}

export class SpotifyApiService implements ISpotifyApiService {
  constructor(private readonly getAccessToken: AccessTokenProvider) {}

  getCurrentUser(): Promise<SpotifyUser> {
    return this.fetchJson<SpotifyUser>(`${BASE_URL}/me`)
  }

  getUserPlaylists(): Promise<SpotifyPlaylist[]> {
    return this.fetchAllPages<PlaylistsResponse, SpotifyPlaylist>(
      '/me/playlists?limit=50',
      (page) => page.items,
    )
  }

  getPlaylistTracks(playlistId: string): Promise<SpotifyTrack[]> {
    return this.fetchAllPages<PlaylistTracksResponse, SpotifyTrack>(
      `/playlists/${playlistId}/items?limit=100`,
      (page) => page.items.map((entry) => entry.item).filter(isTrack),
    )
  }

  async startPlayback(deviceId: string, trackUri: string): Promise<void> {
    const token = await this.requireAccessToken()
    const response = await fetch(`${BASE_URL}/me/player/play?device_id=${deviceId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ uris: [trackUri] }),
    })
    if (!response.ok) throw new Error(await extractErrorMessage(response))
  }

  private async requireAccessToken(): Promise<string> {
    const token = await this.getAccessToken()
    if (!token) throw new Error('Not authenticated')
    return token
  }

  private async fetchAllPages<Page extends { next: string | null }, Item>(
    firstPath: string,
    itemsOf: (page: Page) => Item[],
  ): Promise<Item[]> {
    const items: Item[] = []
    let nextUrl: string | null = `${BASE_URL}${firstPath}`
    for (let pageCount = 0; nextUrl && pageCount < MAX_PAGES; pageCount++) {
      const page: Page = await this.fetchJson<Page>(nextUrl)
      items.push(...itemsOf(page))
      nextUrl = page.next?.startsWith(`${BASE_URL}/`) ? page.next : null
    }
    return items
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const token = await this.requireAccessToken()
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!response.ok) {
      const message = await extractErrorMessage(response)
      console.error(`[api] ${response.status} on ${url}:`, message)
      throw new Error(message)
    }

    return response.json() as Promise<T>
  }
}
