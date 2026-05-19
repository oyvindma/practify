import { authStore } from '$lib/stores/authStore'

const BASE_URL = 'https://api.spotify.com/v1'

async function apiFetch<T>(path: string): Promise<T> {
  const token = await authStore.getValidToken()
  if (!token) throw new Error('Not authenticated')

  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) {
    const body = await response.text()
    let message = `HTTP ${response.status}`
    try {
      const json = JSON.parse(body)
      message = json?.error?.message ?? message
    } catch {
      message = body || message
    }
    console.error(`[api] ${response.status} on ${path}:`, message)
    throw new Error(message)
  }

  return response.json() as Promise<T>
}

export interface SpotifyPlaylist {
  id: string
  name: string
  images: { url: string }[]
  items: { total: number } | null
}

export interface SpotifyTrack {
  id: string
  uri: string
  name: string
  duration_ms: number
  artists: { name: string }[]
  album: { name: string; images: { url: string }[] }
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

export interface SpotifyUser {
  id: string
  display_name: string
}

export async function getCurrentUser(): Promise<SpotifyUser> {
  return apiFetch<SpotifyUser>('/me')
}

export async function getUserPlaylists(): Promise<SpotifyPlaylist[]> {
  const data = await apiFetch<PlaylistsResponse>('/me/playlists?limit=50')
  return data.items
}

export async function getPlaylistTracks(playlistId: string): Promise<SpotifyTrack[]> {
  const data = await apiFetch<PlaylistTracksResponse>(
    `/playlists/${playlistId}/items?limit=100`,
  )
  return data.items
    .map((i) => i.item)
    .filter((t): t is SpotifyTrack => t != null && typeof t === 'object' && 'album' in t && 'artists' in t)
}

export async function playTrack(token: string, deviceId: string, trackUri: string): Promise<void> {
  const response = await fetch(
    `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ uris: [trackUri] }),
    },
  )
  if (!response.ok) {
    const body = await response.text()
    let message = `HTTP ${response.status}`
    try {
      const json = JSON.parse(body)
      message = json?.error?.message ?? message
    } catch {
      message = body || message
    }
    throw new Error(message)
  }
}
