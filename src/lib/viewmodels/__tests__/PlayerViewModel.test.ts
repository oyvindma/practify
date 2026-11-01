import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest'
import { get } from 'svelte/store'
import type { SpotifyTrack } from '$lib/models/spotify'
import type {
  ISpotifyPlayerService,
  PlaybackSnapshot,
  PlayerListeners,
} from '$lib/services/SpotifyPlayerService'
import { createPlayerViewModel, type PlayerViewModel } from '../PlayerViewModel'

const track: SpotifyTrack = {
  id: 't1',
  uri: 'spotify:track:t1',
  name: 'Song',
  duration_ms: 100_000,
  artists: [],
  album: { name: 'A', images: [] },
}

describe('PlayerViewModel', () => {
  let listeners: PlayerListeners
  let snapshot: PlaybackSnapshot | null
  let playerService: ISpotifyPlayerService & Record<string, AnyMock>
  let apiService: { startPlayback: AnyMock }
  let auth: { getValidToken: Mock<() => Promise<string | null>> }
  let viewModel: PlayerViewModel
  const state = () => get(viewModel.playerState)

  beforeEach(() => {
    vi.useFakeTimers()
    snapshot = { positionMs: 0, durationMs: 100_000, isPaused: false }
    playerService = {
      connect: vi.fn(async (_getToken, l: PlayerListeners) => {
        listeners = l
      }),
      getPlaybackSnapshot: vi.fn(async () => snapshot),
      seek: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn().mockResolvedValue(undefined),
      resume: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn(),
    }
    apiService = { startPlayback: vi.fn().mockResolvedValue(undefined) }
    auth = { getValidToken: vi.fn().mockResolvedValue('token') }
    viewModel = createPlayerViewModel(playerService, apiService as never, auth)
  })

  afterEach(() => {
    viewModel.destroy()
    vi.useRealTimers()
  })

  async function initAndBecomeReady() {
    await viewModel.init()
    listeners.onReady('device-1')
  }

  describe('init', () => {
    it('does not connect without a token', async () => {
      auth.getValidToken.mockResolvedValue(null)
      await viewModel.init()
      expect(playerService.connect).not.toHaveBeenCalled()
    })

    it('connects only once', async () => {
      await viewModel.init()
      await viewModel.init()
      expect(playerService.connect).toHaveBeenCalledTimes(1)
    })

    it('tracks readiness and device id', async () => {
      await initAndBecomeReady()
      expect(state()).toMatchObject({ isReady: true, deviceId: 'device-1' })
      listeners.onNotReady()
      expect(state()).toMatchObject({ isReady: false, deviceId: null })
    })

    it('reflects playback changes', async () => {
      await initAndBecomeReady()
      listeners.onPlaybackChanged({ positionMs: 5000, durationMs: 90_000, isPaused: false })
      expect(state()).toMatchObject({ positionMs: 5000, durationMs: 90_000, isPlaying: true })
    })

    it('can be initialised again after destroy', async () => {
      await viewModel.init()
      viewModel.destroy()
      await viewModel.init()
      expect(playerService.connect).toHaveBeenCalledTimes(2)
      expect(playerService.disconnect).toHaveBeenCalledTimes(1)
    })
  })

  describe('playTrack', () => {
    it('sets the track, clears the loop and starts playback on the device', async () => {
      await initAndBecomeReady()
      viewModel.activateLoop({ id: 'x', startMs: 0, endMs: 10 })
      await viewModel.playTrack(track)
      expect(state().track).toEqual(track)
      expect(state().activeLoop).toBeNull()
      expect(apiService.startPlayback).toHaveBeenCalledWith('device-1', track.uri)
    })

    it('does not change the track or loop when there is no device', async () => {
      viewModel.activateLoop({ id: 'x', startMs: 0, endMs: 10 })
      await viewModel.playTrack(track)
      expect(state().track).toBeNull()
      expect(state().activeLoop).not.toBeNull()
      expect(state().playbackError).toContain('ikke klar')
      expect(apiService.startPlayback).not.toHaveBeenCalled()
    })

    it('keeps the previous track, loop and shows an error when Spotify rejects the request', async () => {
      await initAndBecomeReady()
      await viewModel.playTrack(track)
      viewModel.activateLoop({ id: 'x', startMs: 0, endMs: 10 })
      apiService.startPlayback.mockRejectedValueOnce(new Error('Premium required'))
      await viewModel.playTrack({ ...track, id: 't2', uri: 'spotify:track:t2' })
      expect(state().track?.id).toBe('t1')
      expect(state().activeLoop).not.toBeNull()
      expect(state().playbackError).toBe('Kunne ikke spille av låten: Premium required')
    })

    it('clears an earlier playback error on the next attempt', async () => {
      await initAndBecomeReady()
      apiService.startPlayback.mockRejectedValueOnce(new Error('boom'))
      await viewModel.playTrack(track)
      await viewModel.playTrack(track)
      expect(state().playbackError).toBeNull()
      expect(state().track?.id).toBe('t1')
    })
  })

  describe('track reconciliation with the SDK', () => {
    const otherSdkTrack: SpotifyTrack = {
      ...track,
      id: 't9',
      uri: 'spotify:track:t9',
      name: 'Other',
    }

    it('adopts a different track reported by the SDK and drops the loop', async () => {
      await initAndBecomeReady()
      await viewModel.playTrack(track)
      listeners.onPlaybackChanged({ positionMs: 0, durationMs: 1, isPaused: false, track })
      viewModel.activateLoop({ id: 'x', startMs: 0, endMs: 10 })

      listeners.onPlaybackChanged({
        positionMs: 0,
        durationMs: 1,
        isPaused: false,
        track: otherSdkTrack,
      })
      expect(state().track).toEqual(otherSdkTrack)
      expect(state().activeLoop).toBeNull()
    })

    it('keeps the track and loop when the SDK reports the same track', async () => {
      await initAndBecomeReady()
      await viewModel.playTrack(track)
      viewModel.activateLoop({ id: 'x', startMs: 0, endMs: 10 })
      listeners.onPlaybackChanged({ positionMs: 5, durationMs: 1, isPaused: false, track })
      expect(state().activeLoop?.id).toBe('x')
    })

    it('ignores events about the old track while a requested track is starting', async () => {
      await initAndBecomeReady()
      await viewModel.playTrack(track)
      let finishRequest: () => void = () => {}
      apiService.startPlayback.mockReturnValueOnce(new Promise<void>((r) => (finishRequest = r)))
      const second = { ...track, id: 't2', uri: 'spotify:track:t2' }
      const pending = viewModel.playTrack(second)

      listeners.onPlaybackChanged({ positionMs: 0, durationMs: 1, isPaused: true, track })
      expect(state().track?.id).toBe('t1')

      listeners.onPlaybackChanged({ positionMs: 0, durationMs: 1, isPaused: false, track: second })
      finishRequest()
      await pending
      expect(state().track?.id).toBe('t2')

      listeners.onPlaybackChanged({
        positionMs: 0,
        durationMs: 1,
        isPaused: false,
        track: otherSdkTrack,
      })
      expect(state().track?.id).toBe('t9')
    })

    it('adopts the SDK track when nothing was selected yet', async () => {
      await initAndBecomeReady()
      listeners.onPlaybackChanged({ positionMs: 0, durationMs: 1, isPaused: false, track })
      expect(state().track).toEqual(track)
    })

    it('ignores snapshots without track information', async () => {
      await initAndBecomeReady()
      await viewModel.playTrack(track)
      listeners.onPlaybackChanged({ positionMs: 0, durationMs: 1, isPaused: false })
      expect(state().track?.id).toBe('t1')
    })
  })

  describe('errors and connection', () => {
    it('reports a connection error and allows a retry', async () => {
      vi.mocked(playerService.connect).mockRejectedValueOnce(new Error('script blocked'))
      await viewModel.init()
      expect(state().connectionError).toContain('script blocked')

      await viewModel.init()
      expect(playerService.connect).toHaveBeenCalledTimes(2)
      expect(state().connectionError).toBeNull()
    })

    it('maps SDK account, authentication and initialization errors to connection errors', async () => {
      await viewModel.init()
      listeners.onError('account', 'x')
      expect(state().connectionError).toContain('Premium')
      listeners.onError('authentication', 'x')
      expect(state().connectionError).toContain('logg ut')
      listeners.onError('initialization', 'unsupported')
      expect(state().connectionError).toContain('unsupported')
    })

    it('maps SDK playback errors to a playback error', async () => {
      await viewModel.init()
      listeners.onError('playback', 'Cannot load track')
      expect(state().playbackError).toBe('Avspillingsfeil: Cannot load track')
      expect(state().connectionError).toBeNull()
    })

    it('shows an error when seeking fails instead of rejecting', async () => {
      vi.mocked(playerService.seek).mockRejectedValueOnce(new Error('seek denied'))
      await expect(viewModel.seek(1000)).resolves.toBeUndefined()
      expect(state().playbackError).toContain('seek denied')
    })

    it('shows an error when pause or resume fails', async () => {
      vi.mocked(playerService.resume).mockRejectedValueOnce(new Error('nope'))
      await viewModel.togglePlay()
      expect(state().playbackError).toContain('nope')
    })
  })

  describe('scrubbing', () => {
    it('shows the scrub position instead of the polled one while dragging', async () => {
      await initAndBecomeReady()
      listeners.onPlaybackChanged({ positionMs: 1000, durationMs: 100_000, isPaused: false })
      viewModel.scrubTo(50_000)
      listeners.onPlaybackChanged({ positionMs: 2000, durationMs: 100_000, isPaused: false })
      expect(get(viewModel.displayPositionMs)).toBe(50_000)
    })

    it('seeks immediately on the first drag event and then throttles', async () => {
      viewModel.scrubTo(1000)
      expect(playerService.seek).toHaveBeenCalledTimes(1)
      viewModel.scrubTo(2000)
      viewModel.scrubTo(3000)
      viewModel.scrubTo(4000)
      expect(playerService.seek).toHaveBeenCalledTimes(1)

      await vi.advanceTimersByTimeAsync(200)
      expect(playerService.seek).toHaveBeenCalledTimes(2)
      expect(playerService.seek).toHaveBeenLastCalledWith(4000)
    })

    it('does not seek again when the value did not change', async () => {
      viewModel.scrubTo(1000)
      await vi.advanceTimersByTimeAsync(1000)
      expect(playerService.seek).toHaveBeenCalledTimes(1)
    })

    it('commits the final position, leaves scrubbing and returns to the polled position', async () => {
      viewModel.scrubTo(1000)
      await viewModel.commitScrub(9000)
      expect(playerService.seek).toHaveBeenLastCalledWith(9000)
      expect(state().scrubPositionMs).toBeNull()
      expect(state().positionMs).toBe(9000)
      expect(get(viewModel.displayPositionMs)).toBe(9000)
      vi.mocked(playerService.seek).mockClear()
      await vi.advanceTimersByTimeAsync(1000)
      expect(playerService.seek).not.toHaveBeenCalled()
    })
  })

  describe('togglePlay', () => {
    it('pauses when playing and resumes when paused', async () => {
      await initAndBecomeReady()
      listeners.onPlaybackChanged({ positionMs: 0, durationMs: 1, isPaused: false })
      await viewModel.togglePlay()
      expect(playerService.pause).toHaveBeenCalled()

      listeners.onPlaybackChanged({ positionMs: 0, durationMs: 1, isPaused: true })
      await viewModel.togglePlay()
      expect(playerService.resume).toHaveBeenCalled()
    })
  })

  describe('progress polling', () => {
    it('updates position every 500 ms while playing', async () => {
      await initAndBecomeReady()
      listeners.onPlaybackChanged({ positionMs: 0, durationMs: 100_000, isPaused: false })
      snapshot = { positionMs: 7000, durationMs: 100_000, isPaused: false }
      await vi.advanceTimersByTimeAsync(500)
      expect(state().positionMs).toBe(7000)
    })

    it('stops polling when paused', async () => {
      await initAndBecomeReady()
      listeners.onPlaybackChanged({ positionMs: 0, durationMs: 100_000, isPaused: false })
      listeners.onPlaybackChanged({ positionMs: 0, durationMs: 100_000, isPaused: true })
      vi.mocked(playerService.getPlaybackSnapshot).mockClear()
      await vi.advanceTimersByTimeAsync(2000)
      expect(playerService.getPlaybackSnapshot).not.toHaveBeenCalled()
    })
  })

  describe('loops', () => {
    it('activating seeks to the start and records the loop', () => {
      viewModel.activateLoop({ id: 'bm', startMs: 10_000, endMs: 20_000 })
      expect(state().activeLoop).toEqual({ id: 'bm', startMs: 10_000, endMs: 20_000 })
      expect(playerService.seek).toHaveBeenCalledWith(10_000)
    })

    it('can start from another position', () => {
      viewModel.activateLoop({ startMs: 10_000, endMs: 20_000 }, { startFrom: 18_000 })
      expect(playerService.seek).toHaveBeenCalledWith(18_000)
      expect(state().activeLoop?.id).toBeNull()
    })

    it('seeks back to the start when the end is reached', async () => {
      viewModel.activateLoop({ startMs: 10_000, endMs: 20_000 })
      vi.mocked(playerService.seek).mockClear()

      snapshot = { positionMs: 15_000, durationMs: 100_000, isPaused: false }
      await vi.advanceTimersByTimeAsync(0)
      expect(playerService.seek).not.toHaveBeenCalled()
      expect(state().positionMs).toBe(15_000)

      snapshot = { positionMs: 20_050, durationMs: 100_000, isPaused: false }
      await vi.advanceTimersByTimeAsync(100)
      expect(playerService.seek).toHaveBeenCalledWith(10_000)
    })

    it('stops looping after deactivation', async () => {
      viewModel.activateLoop({ startMs: 10_000, endMs: 20_000 })
      viewModel.deactivateLoop()
      vi.mocked(playerService.seek).mockClear()
      snapshot = { positionMs: 30_000, durationMs: 100_000, isPaused: false }
      await vi.advanceTimersByTimeAsync(1000)
      expect(playerService.seek).not.toHaveBeenCalled()
      expect(state().activeLoop).toBeNull()
    })

    it('toggleLoop activates and then deactivates the same bookmark', () => {
      const loop = { id: 'bm', startMs: 1000, endMs: 2000 }
      viewModel.toggleLoop(loop)
      expect(state().activeLoop?.id).toBe('bm')
      viewModel.toggleLoop(loop)
      expect(state().activeLoop).toBeNull()
    })

    it('toggleLoop switches to another bookmark', () => {
      viewModel.toggleLoop({ id: 'a', startMs: 1000, endMs: 2000 })
      viewModel.toggleLoop({ id: 'b', startMs: 3000, endMs: 4000 })
      expect(state().activeLoop).toEqual({ id: 'b', startMs: 3000, endMs: 4000 })
    })

    it('exposes the loop region as percentages of the duration', async () => {
      await initAndBecomeReady()
      listeners.onPlaybackChanged({ positionMs: 0, durationMs: 100_000, isPaused: true })
      expect(get(viewModel.loopRegion)).toBeNull()
      viewModel.activateLoop({ startMs: 25_000, endMs: 75_000 })
      expect(get(viewModel.loopRegion)).toEqual({ startPercent: 25, widthPercent: 50 })
    })
  })

  describe('retimeActiveLoop', () => {
    it('updates the loop range without seeking', () => {
      viewModel.activateLoop({ id: 'bm', startMs: 10_000, endMs: 20_000 })
      vi.mocked(playerService.seek).mockClear()
      viewModel.retimeActiveLoop({ id: 'bm', startMs: 12_000, endMs: 18_000 })
      expect(state().activeLoop).toEqual({ id: 'bm', startMs: 12_000, endMs: 18_000 })
      expect(playerService.seek).not.toHaveBeenCalled()
    })

    it('ignores a loop that is not the active one', () => {
      viewModel.activateLoop({ id: 'bm', startMs: 10_000, endMs: 20_000 })
      viewModel.retimeActiveLoop({ id: 'other', startMs: 1, endMs: 2 })
      expect(state().activeLoop).toEqual({ id: 'bm', startMs: 10_000, endMs: 20_000 })
    })

    it('enforces the new end', async () => {
      viewModel.activateLoop({ id: 'bm', startMs: 10_000, endMs: 20_000 })
      await vi.advanceTimersByTimeAsync(0)
      viewModel.retimeActiveLoop({ id: 'bm', startMs: 12_000, endMs: 14_000 })
      vi.mocked(playerService.seek).mockClear()
      snapshot = { positionMs: 15_000, durationMs: 100_000, isPaused: false }
      await vi.advanceTimersByTimeAsync(100)
      expect(playerService.seek).toHaveBeenCalledWith(12_000)
    })
  })

  describe('deactivatePreviewLoop', () => {
    it('stops a preview loop (no bookmark id)', () => {
      viewModel.activateLoop({ startMs: 1000, endMs: 2000 })
      viewModel.deactivatePreviewLoop()
      expect(state().activeLoop).toBeNull()
    })

    it('leaves a bookmark loop running', () => {
      viewModel.activateLoop({ id: 'bm', startMs: 1000, endMs: 2000 })
      viewModel.deactivatePreviewLoop()
      expect(state().activeLoop?.id).toBe('bm')
    })
  })

  describe('getCurrentPositionMs', () => {
    it('reads a fresh position from the SDK and stores it', async () => {
      snapshot = { positionMs: 33_333, durationMs: 100_000, isPaused: false }
      expect(await viewModel.getCurrentPositionMs()).toBe(33_333)
      expect(state().positionMs).toBe(33_333)
    })

    it('falls back to the last known position when the SDK has no state', async () => {
      await initAndBecomeReady()
      listeners.onPlaybackChanged({ positionMs: 4000, durationMs: 100_000, isPaused: true })
      snapshot = null
      expect(await viewModel.getCurrentPositionMs()).toBe(4000)
    })
  })

  describe('destroy', () => {
    it('disconnects and resets state', async () => {
      await initAndBecomeReady()
      await viewModel.playTrack(track)
      viewModel.destroy()
      expect(playerService.disconnect).toHaveBeenCalled()
      expect(state().track).toBeNull()
      expect(state().isReady).toBe(false)
    })
  })
})

type AnyMock = Mock<(...args: never[]) => unknown>
