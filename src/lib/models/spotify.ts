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

export interface SpotifyUser {
  id: string
  display_name: string
}
