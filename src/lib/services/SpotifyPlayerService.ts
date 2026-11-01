import type { SpotifyTrack } from '$lib/models/spotify'
import { loadSpotifySDK } from '$lib/spotify/sdk'

export interface PlaybackSnapshot {
  positionMs: number
  durationMs: number
  isPaused: boolean
  track?: SpotifyTrack | null
}

export type PlayerErrorKind = 'initialization' | 'authentication' | 'account' | 'playback'

export interface PlayerListeners {
  onReady(deviceId: string): void
  onNotReady(): void
  onPlaybackChanged(snapshot: PlaybackSnapshot): void
  onError(kind: PlayerErrorKind, message: string): void
}

export interface ISpotifyPlayerService {
  connect(getAccessToken: () => Promise<string | null>, listeners: PlayerListeners): Promise<void>
  getPlaybackSnapshot(): Promise<PlaybackSnapshot | null>
  seek(positionMs: number): Promise<void>
  pause(): Promise<void>
  resume(): Promise<void>
  disconnect(): void
}

const DEVICE_NAME = 'Spotify Practice Tool'
const INITIAL_VOLUME = 0.8

const ERROR_EVENTS: Record<Spotify.ErrorTypes, PlayerErrorKind> = {
  initialization_error: 'initialization',
  authentication_error: 'authentication',
  account_error: 'account',
  playback_error: 'playback',
}

function toSpotifyTrack(state: Spotify.PlaybackState): SpotifyTrack | null {
  const current = state.track_window?.current_track
  if (!current?.id || current.type !== 'track') return null
  return {
    id: current.id,
    uri: current.uri,
    name: current.name,
    duration_ms: state.duration,
    artists: current.artists.map((artist) => ({ name: artist.name })),
    album: {
      name: current.album.name,
      images: current.album.images.map((image) => ({ url: image.url })),
    },
  }
}

function toSnapshot(state: Spotify.PlaybackState): PlaybackSnapshot {
  return {
    positionMs: state.position,
    durationMs: state.duration,
    isPaused: state.paused,
    track: toSpotifyTrack(state),
  }
}

export class SpotifyPlayerService implements ISpotifyPlayerService {
  private player: Spotify.Player | null = null

  async connect(
    getAccessToken: () => Promise<string | null>,
    listeners: PlayerListeners,
  ): Promise<void> {
    await loadSpotifySDK()

    const player = new window.Spotify.Player({
      name: DEVICE_NAME,
      getOAuthToken: async (provideToken) => {
        const token = await getAccessToken()
        if (token) provideToken(token)
      },
      volume: INITIAL_VOLUME,
    })

    player.addListener('ready', ({ device_id }) => listeners.onReady(device_id))
    player.addListener('not_ready', () => listeners.onNotReady())
    player.addListener('player_state_changed', (state) => {
      if (state) listeners.onPlaybackChanged(toSnapshot(state))
    })
    for (const [event, kind] of Object.entries(ERROR_EVENTS)) {
      player.addListener(event as Spotify.ErrorTypes, ({ message }) =>
        listeners.onError(kind, message),
      )
    }

    this.player = player
    const connected = await player.connect()
    if (!connected) {
      player.disconnect()
      this.player = null
      throw new Error('The Spotify player could not connect')
    }
  }

  async getPlaybackSnapshot(): Promise<PlaybackSnapshot | null> {
    const state = await this.player?.getCurrentState()
    return state ? toSnapshot(state) : null
  }

  async seek(positionMs: number): Promise<void> {
    await this.player?.seek(positionMs)
  }

  async pause(): Promise<void> {
    await this.player?.pause()
  }

  async resume(): Promise<void> {
    await this.player?.resume()
  }

  disconnect(): void {
    this.player?.disconnect()
    this.player = null
  }
}
