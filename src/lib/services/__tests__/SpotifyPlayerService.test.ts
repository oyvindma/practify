import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import type { PlayerListeners } from '../SpotifyPlayerService'

vi.mock('$lib/spotify/sdk', () => ({ loadSpotifySDK: vi.fn().mockResolvedValue(undefined) }))

import { SpotifyPlayerService } from '../SpotifyPlayerService'

type Handler = (payload?: unknown) => void

function createFakePlayer() {
  const handlers = new Map<string, Handler>()
  return {
    handlers,
    addListener: vi.fn((event: string, handler: Handler) => handlers.set(event, handler)),
    connect: vi.fn().mockResolvedValue(true) as Mock<() => Promise<boolean>>,
    disconnect: vi.fn(),
    getCurrentState: vi.fn(),
    seek: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
  }
}

const sdkState = (overrides: Record<string, unknown> = {}) => ({
  position: 1234,
  duration: 200_000,
  paused: false,
  track_window: {
    current_track: {
      id: 'abc',
      uri: 'spotify:track:abc',
      name: 'Song',
      type: 'track',
      artists: [{ name: 'Artist', uri: 'u', url: '' }],
      album: { name: 'Album', uri: 'a', images: [{ url: 'http://img', height: 1, width: 1 }] },
    },
  },
  ...overrides,
})

describe('SpotifyPlayerService', () => {
  let fakePlayer: ReturnType<typeof createFakePlayer>
  let listeners: { [K in keyof PlayerListeners]: Mock<PlayerListeners[K]> }
  let service: SpotifyPlayerService
  let playerInit: { getOAuthToken: (cb: (token: string) => void) => void } | undefined

  beforeEach(() => {
    fakePlayer = createFakePlayer()
    playerInit = undefined
    vi.stubGlobal('Spotify', {
      Player: function (init: typeof playerInit) {
        playerInit = init
        return fakePlayer
      },
    })
    window.Spotify = globalThis.Spotify as typeof window.Spotify
    listeners = {
      onReady: vi.fn(),
      onNotReady: vi.fn(),
      onPlaybackChanged: vi.fn(),
      onError: vi.fn(),
    }
    service = new SpotifyPlayerService()
  })

  it('forwards ready and not_ready', async () => {
    await service.connect(async () => 't', listeners)
    fakePlayer.handlers.get('ready')?.({ device_id: 'dev-1' })
    fakePlayer.handlers.get('not_ready')?.({ device_id: 'dev-1' })
    expect(listeners.onReady).toHaveBeenCalledWith('dev-1')
    expect(listeners.onNotReady).toHaveBeenCalled()
  })

  it('maps a state change to a snapshot including the current track', async () => {
    await service.connect(async () => 't', listeners)
    fakePlayer.handlers.get('player_state_changed')?.(sdkState())
    expect(listeners.onPlaybackChanged).toHaveBeenCalledWith({
      positionMs: 1234,
      durationMs: 200_000,
      isPaused: false,
      track: {
        id: 'abc',
        uri: 'spotify:track:abc',
        name: 'Song',
        duration_ms: 200_000,
        artists: [{ name: 'Artist' }],
        album: { name: 'Album', images: [{ url: 'http://img' }] },
      },
    })
  })

  it('reports no track for episodes and local files', async () => {
    await service.connect(async () => 't', listeners)
    const handler = fakePlayer.handlers.get('player_state_changed')!
    const base = sdkState()
    handler({
      ...base,
      track_window: { current_track: { ...base.track_window.current_track, type: 'episode' } },
    })
    handler({
      ...base,
      track_window: { current_track: { ...base.track_window.current_track, id: null } },
    })
    expect(listeners.onPlaybackChanged.mock.calls.map(([s]) => s.track)).toEqual([null, null])
  })

  it('ignores a null state', async () => {
    await service.connect(async () => 't', listeners)
    fakePlayer.handlers.get('player_state_changed')?.(null)
    expect(listeners.onPlaybackChanged).not.toHaveBeenCalled()
  })

  it('forwards all four SDK error types', async () => {
    await service.connect(async () => 't', listeners)
    for (const event of [
      'initialization_error',
      'authentication_error',
      'account_error',
      'playback_error',
    ]) {
      fakePlayer.handlers.get(event)?.({ message: event })
    }
    expect(listeners.onError.mock.calls).toEqual([
      ['initialization', 'initialization_error'],
      ['authentication', 'authentication_error'],
      ['account', 'account_error'],
      ['playback', 'playback_error'],
    ])
  })

  it('throws and disconnects when the SDK cannot connect', async () => {
    fakePlayer.connect.mockResolvedValueOnce(false)
    await expect(service.connect(async () => 't', listeners)).rejects.toThrow('could not connect')
    expect(fakePlayer.disconnect).toHaveBeenCalled()
    expect(await service.getPlaybackSnapshot()).toBeNull()
  })

  it('hands the access token to the SDK on request', async () => {
    await service.connect(async () => 'fresh-token', listeners)
    const provide = vi.fn()
    playerInit?.getOAuthToken(provide)
    await vi.waitFor(() => expect(provide).toHaveBeenCalledWith('fresh-token'))
  })

  it('reads a snapshot, or null when the SDK has no state', async () => {
    await service.connect(async () => 't', listeners)
    fakePlayer.getCurrentState.mockResolvedValueOnce(sdkState({ paused: true }))
    expect((await service.getPlaybackSnapshot())?.isPaused).toBe(true)
    fakePlayer.getCurrentState.mockResolvedValueOnce(null)
    expect(await service.getPlaybackSnapshot()).toBeNull()
  })

  it('delegates seek, pause, resume and disconnect', async () => {
    await service.connect(async () => 't', listeners)
    await service.seek(500)
    await service.pause()
    await service.resume()
    service.disconnect()
    expect(fakePlayer.seek).toHaveBeenCalledWith(500)
    expect(fakePlayer.pause).toHaveBeenCalled()
    expect(fakePlayer.resume).toHaveBeenCalled()
    expect(fakePlayer.disconnect).toHaveBeenCalled()
  })

  it('is a harmless no-op before connecting', async () => {
    await expect(service.seek(1)).resolves.toBeUndefined()
    expect(await service.getPlaybackSnapshot()).toBeNull()
    expect(() => service.disconnect()).not.toThrow()
  })
})
