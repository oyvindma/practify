import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest'
import { get, writable } from 'svelte/store'
import { INITIAL_PLAYER_STATE, type ActiveLoop, type PlayerState } from '$lib/models/player'
import type { SpotifyTrack } from '$lib/models/spotify'
import type { PracticeClockOptions } from '$lib/playback/PracticeClock'
import { createMetronomeViewModel, type MetronomeViewModel } from '../MetronomeViewModel'

function makeTrack(id: string): SpotifyTrack {
  return {
    id,
    uri: `spotify:track:${id}`,
    name: `Song ${id}`,
    duration_ms: 200_000,
    artists: [{ name: 'Band' }],
    album: { name: 'Album', images: [] },
  }
}

const loop = (startMs: number, endMs: number): ActiveLoop => ({ id: 'bm', startMs, endMs })
const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

describe('MetronomeViewModel', () => {
  let playerState: ReturnType<typeof writable<PlayerState>>
  let player: {
    togglePlay: Mock<() => Promise<void>>
    seek: Mock<(positionMs: number) => Promise<void>>
    getCurrentPositionMs: Mock<() => Promise<number>>
  }
  let bpmService: { getBpm: Mock<(id: string) => Promise<number | null>> }
  let storage: {
    getBpm: Mock<(id: string) => number | null>
    saveBpm: Mock<(id: string, bpm: number) => void>
    getBeatOffsetMs: Mock<(id: string) => number | null>
    saveBeatOffsetMs: Mock<(id: string, offsetMs: number) => void>
    clearBeatOffsetMs: Mock<(id: string) => void>
  }
  let metronome: {
    start: Mock<(bpm: number, delayMs?: number) => void>
    setBpm: Mock<(bpm: number) => void>
    stop: Mock<() => void>
  }
  let clock: {
    start: Mock<(options: PracticeClockOptions) => void>
    setLoop: Mock<() => void>
    seekTo: Mock<(positionMs: number) => void>
    stop: Mock<() => void>
  }
  let viewModel: MetronomeViewModel
  let unsubscribe: () => void

  const state = () => get(viewModel.metronomeState)
  const practicePosition = () => get(viewModel.practicePositionMs)
  const clockOptions = () => clock.start.mock.calls.at(-1)![0]
  const update = (changes: Partial<PlayerState>) =>
    playerState.update((s) => ({ ...s, ...changes }))
  const playTrack = (id: string, changes: Partial<PlayerState> = {}) =>
    update({ track: makeTrack(id), durationMs: 200_000, ...changes })

  beforeEach(() => {
    playerState = writable({ ...INITIAL_PLAYER_STATE })
    player = {
      togglePlay: vi.fn().mockResolvedValue(undefined),
      seek: vi.fn().mockResolvedValue(undefined),
      getCurrentPositionMs: vi.fn().mockResolvedValue(0),
    }
    bpmService = { getBpm: vi.fn().mockResolvedValue(171.001) }
    storage = {
      getBpm: vi.fn().mockReturnValue(null),
      saveBpm: vi.fn(),
      getBeatOffsetMs: vi.fn().mockReturnValue(null),
      saveBeatOffsetMs: vi.fn(),
      clearBeatOffsetMs: vi.fn(),
    }
    metronome = { start: vi.fn(), setBpm: vi.fn(), stop: vi.fn() }
    clock = { start: vi.fn(), setLoop: vi.fn(), seekTo: vi.fn(), stop: vi.fn() }
    viewModel = createMetronomeViewModel(
      { playerState, ...player },
      bpmService,
      storage,
      metronome,
      clock,
    )
    unsubscribe = viewModel.metronomeState.subscribe(() => {})
  })

  afterEach(() => unsubscribe())

  describe('loading bpm', () => {
    it('is idle without a track', () => {
      expect(state()).toEqual({
        bpm: null,
        isRunning: false,
        lookupStatus: 'idle',
        mode: 'withSong',
        beatOffsetMs: null,
        isSyncing: false,
        syncTapCount: 0,
      })
    })

    it('fetches, rounds and stores the bpm for a new track', async () => {
      playTrack('1')
      expect(state().lookupStatus).toBe('loading')
      await vi.waitFor(() => expect(state().lookupStatus).toBe('found'))
      expect(state().bpm).toBe(171)
      expect(bpmService.getBpm).toHaveBeenCalledWith('1')
      expect(storage.saveBpm).toHaveBeenCalledWith('1', 171)
    })

    it('uses the stored bpm without a network call', () => {
      storage.getBpm.mockReturnValue(90)
      playTrack('1')
      expect(state()).toMatchObject({ bpm: 90, isRunning: false, lookupStatus: 'found' })
      expect(bpmService.getBpm).not.toHaveBeenCalled()
    })

    it('reports notFound and error', async () => {
      bpmService.getBpm.mockResolvedValueOnce(null)
      playTrack('1')
      await vi.waitFor(() => expect(state().lookupStatus).toBe('notFound'))
      expect(state().bpm).toBeNull()

      bpmService.getBpm.mockRejectedValueOnce(new Error('boom'))
      playTrack('2')
      await vi.waitFor(() => expect(state().lookupStatus).toBe('error'))
    })

    it('ignores a slow response for a previous track', async () => {
      let resolveFirst: (tempo: number) => void = () => {}
      bpmService.getBpm
        .mockReturnValueOnce(new Promise((resolve) => (resolveFirst = resolve)))
        .mockResolvedValueOnce(100)
      playTrack('1')
      playTrack('2')
      await vi.waitFor(() => expect(state().bpm).toBe(100))
      resolveFirst(150)
      await Promise.resolve()
      expect(state().bpm).toBe(100)
      expect(storage.saveBpm).not.toHaveBeenCalledWith('1', 150)
    })

    it('keeps a bpm the user set while the lookup was running', async () => {
      let resolveLookup: (tempo: number) => void = () => {}
      bpmService.getBpm.mockReturnValueOnce(new Promise((resolve) => (resolveLookup = resolve)))
      playTrack('1')
      viewModel.setBpm(80)
      resolveLookup(150)
      await Promise.resolve()
      expect(state().bpm).toBe(80)
      expect(storage.saveBpm).toHaveBeenCalledTimes(1)
      expect(storage.saveBpm).toHaveBeenCalledWith('1', 80)
    })
  })

  describe('editing bpm', () => {
    beforeEach(() => {
      storage.getBpm.mockReturnValue(100)
      playTrack('1')
    })

    it('clamps and stores', () => {
      viewModel.setBpm(500)
      expect(state().bpm).toBe(300)
      expect(storage.saveBpm).toHaveBeenCalledWith('1', 300)
    })

    it('ignores non-finite values', () => {
      viewModel.setBpm(Number.NaN)
      expect(state().bpm).toBe(100)
    })

    it('nudges and scales', () => {
      viewModel.nudgeBpm(1)
      expect(state().bpm).toBe(101)
      viewModel.scaleBpm(2)
      expect(state().bpm).toBe(202)
      viewModel.scaleBpm(0.5)
      expect(state().bpm).toBe(101)
    })

    it('derives bpm from taps and restarts after a pause', () => {
      viewModel.tap(0)
      viewModel.tap(500)
      expect(state().bpm).toBe(120)
      viewModel.tap(10_000)
      expect(state().bpm).toBe(120)
      viewModel.tap(10_600)
      expect(state().bpm).toBe(100)
    })
  })

  describe('with the song', () => {
    beforeEach(() => {
      storage.getBpm.mockReturnValue(120)
      playTrack('1', { isPlaying: true })
    })

    it('does nothing without a bpm', () => {
      storage.getBpm.mockReturnValue(null)
      bpmService.getBpm.mockResolvedValue(null)
      playTrack('2')
      viewModel.toggle()
      expect(state().isRunning).toBe(false)
      expect(metronome.start).not.toHaveBeenCalled()
    })

    it('aligns the first click to the beat grid of the song position', async () => {
      player.getCurrentPositionMs.mockResolvedValue(1100)
      viewModel.toggle()
      await flush()
      expect(state().isRunning).toBe(true)
      expect(metronome.start).toHaveBeenCalledWith(120, 400)
    })

    it('anchors the grid at the active loop start', async () => {
      update({ activeLoop: loop(250, 5000) })
      player.getCurrentPositionMs.mockResolvedValue(1100)
      viewModel.toggle()
      await flush()
      expect(metronome.start).toHaveBeenLastCalledWith(120, 150)
    })

    it('waits for playback when the song is paused, then starts in time', async () => {
      update({ isPlaying: false })
      viewModel.toggle()
      await flush()
      expect(state().isRunning).toBe(true)
      expect(metronome.start).not.toHaveBeenCalled()

      player.getCurrentPositionMs.mockResolvedValue(0)
      update({ isPlaying: true })
      await flush()
      expect(metronome.start).toHaveBeenCalledWith(120, 0)
    })

    it('silences clicks while the song is paused', async () => {
      viewModel.toggle()
      await flush()
      metronome.stop.mockClear()
      update({ isPlaying: false })
      expect(metronome.stop).toHaveBeenCalled()
      expect(state().isRunning).toBe(true)
    })

    it('realigns when the bpm changes or the loop changes', async () => {
      viewModel.toggle()
      await flush()
      metronome.start.mockClear()
      viewModel.setBpm(90)
      await flush()
      expect(metronome.start).toHaveBeenCalledWith(90, 0)

      metronome.start.mockClear()
      update({ activeLoop: loop(0, 4000) })
      await flush()
      expect(metronome.start).toHaveBeenCalledTimes(1)
    })

    it('stops with toggle', async () => {
      viewModel.toggle()
      await flush()
      viewModel.toggle()
      expect(metronome.stop).toHaveBeenCalled()
      expect(state().isRunning).toBe(false)
    })

    it('stops when the track changes', async () => {
      viewModel.toggle()
      await flush()
      playTrack('2')
      expect(state().isRunning).toBe(false)
    })

    it('stops when nothing is subscribed any more', async () => {
      viewModel.toggle()
      await flush()
      metronome.stop.mockClear()
      unsubscribe()
      expect(metronome.stop).toHaveBeenCalled()
    })

    it('seeks to a clicked lyric line and resumes a paused song', async () => {
      update({ isPlaying: false })
      viewModel.playFromLyricLine(31_000)
      await flush()
      expect(player.seek).toHaveBeenCalledWith(31_000)
      expect(player.togglePlay).toHaveBeenCalledTimes(1)
    })

    it('only seeks when the song is already playing', async () => {
      viewModel.playFromLyricLine(31_000)
      await flush()
      expect(player.seek).toHaveBeenCalledWith(31_000)
      expect(player.togglePlay).not.toHaveBeenCalled()
    })

    it('ignores clicked lines while a loop is active', async () => {
      update({ activeLoop: loop(12_000, 20_000) })
      viewModel.playFromLyricLine(31_000)
      await flush()
      expect(player.seek).not.toHaveBeenCalled()
    })

    describe('position jumps', () => {
      beforeEach(() => vi.useFakeTimers())
      afterEach(() => vi.useRealTimers())

      it('realigns after a seek but not after normal progress', async () => {
        update({ positionMs: 1000 })
        viewModel.toggle()
        await flush()
        metronome.start.mockClear()

        vi.advanceTimersByTime(500)
        update({ positionMs: 1500 })
        await flush()
        expect(metronome.start).not.toHaveBeenCalled()

        vi.advanceTimersByTime(500)
        update({ positionMs: 30_000 })
        await flush()
        expect(metronome.start).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe('beat sync', () => {
    const tapAt = async (positionMs: number) => {
      player.getCurrentPositionMs.mockResolvedValueOnce(positionMs)
      viewModel.tapBeat()
      await flush()
    }

    beforeEach(() => {
      storage.getBpm.mockReturnValue(120) // 500 ms per beat
      playTrack('1', { isPlaying: true })
    })

    it('only starts syncing while the song plays with a bpm', () => {
      update({ isPlaying: false })
      viewModel.toggleSync()
      expect(state().isSyncing).toBe(false)

      update({ isPlaying: true })
      viewModel.toggleSync()
      expect(state().isSyncing).toBe(true)
      viewModel.toggleSync()
      expect(state().isSyncing).toBe(false)
    })

    it('does not sync in silent mode', () => {
      viewModel.setMode('silent')
      viewModel.toggleSync()
      expect(state().isSyncing).toBe(false)
    })

    it('ignores taps when not syncing', async () => {
      await tapAt(130)
      expect(state().syncTapCount).toBe(0)
      expect(player.getCurrentPositionMs).not.toHaveBeenCalled()
    })

    it('stores the beat offset once enough taps agree', async () => {
      viewModel.toggleSync()
      await tapAt(130)
      await tapAt(630)
      await tapAt(1130)
      expect(state().beatOffsetMs).toBeNull()
      await tapAt(1630)
      expect(state().beatOffsetMs).toBeCloseTo(130, 5)
      expect(storage.saveBeatOffsetMs).toHaveBeenLastCalledWith('1', expect.closeTo(130, 5))
      expect(state().syncTapCount).toBe(4)
      expect(state().isSyncing).toBe(true)
    })

    it('finishes after the maximum number of taps', async () => {
      viewModel.toggleSync()
      for (let beat = 0; beat < 8; beat++) await tapAt(130 + beat * 500)
      expect(state().isSyncing).toBe(false)
      expect(state().beatOffsetMs).toBeCloseTo(130, 5)
    })

    it('cancels syncing when the song pauses, the mode changes or the track changes', () => {
      viewModel.toggleSync()
      update({ isPlaying: false })
      expect(state().isSyncing).toBe(false)

      update({ isPlaying: true })
      viewModel.toggleSync()
      viewModel.setMode('silent')
      expect(state().isSyncing).toBe(false)
      viewModel.setMode('withSong')

      update({ isPlaying: true })
      viewModel.toggleSync()
      playTrack('2')
      expect(state().isSyncing).toBe(false)
    })

    it('aligns clicks to the synced beat grid instead of 0:00', async () => {
      storage.getBeatOffsetMs.mockReturnValue(130)
      playTrack('2')
      player.getCurrentPositionMs.mockResolvedValue(1000)
      viewModel.toggle()
      await flush()
      // beats at 130, 630, 1130: the next one after 1000 is 130 ms away
      expect(metronome.start).toHaveBeenLastCalledWith(120, 130)
    })

    it('prefers the synced grid over the loop start', async () => {
      storage.getBeatOffsetMs.mockReturnValue(130)
      playTrack('2')
      update({ activeLoop: loop(250, 5000) })
      player.getCurrentPositionMs.mockResolvedValue(1000)
      viewModel.toggle()
      await flush()
      expect(metronome.start).toHaveBeenLastCalledWith(120, 130)
    })

    it('loads the stored offset for the track', () => {
      storage.getBeatOffsetMs.mockReturnValue(222)
      playTrack('2')
      expect(storage.getBeatOffsetMs).toHaveBeenCalledWith('2')
      expect(state().beatOffsetMs).toBe(222)
    })

    it('realigns running clicks when the offset changes', async () => {
      storage.getBeatOffsetMs.mockReturnValue(130)
      playTrack('2')
      player.getCurrentPositionMs.mockResolvedValue(1000)
      viewModel.toggle()
      await flush()
      metronome.start.mockClear()
      viewModel.nudgeBeatOffset(10)
      await flush()
      // beats now fall at 140, 640, 1140: the next one after 1000 is 140 ms away
      expect(metronome.start).toHaveBeenCalledWith(120, 140)
    })

    it('nudges and stores the offset, wrapping within a beat', () => {
      storage.getBeatOffsetMs.mockReturnValue(495)
      playTrack('2')
      viewModel.nudgeBeatOffset(10)
      expect(state().beatOffsetMs).toBe(5)
      expect(storage.saveBeatOffsetMs).toHaveBeenCalledWith('2', 5)
    })

    it('ignores nudges before the song is synced', () => {
      viewModel.nudgeBeatOffset(10)
      expect(state().beatOffsetMs).toBeNull()
      expect(storage.saveBeatOffsetMs).not.toHaveBeenCalled()
    })

    it('forgets the sync', () => {
      storage.getBeatOffsetMs.mockReturnValue(130)
      playTrack('2')
      viewModel.resetSync()
      expect(state().beatOffsetMs).toBeNull()
      expect(storage.clearBeatOffsetMs).toHaveBeenCalledWith('2')
    })

    it('starts silent clicks and loop laps on the synced grid', () => {
      storage.getBeatOffsetMs.mockReturnValue(130)
      playTrack('2')
      update({ activeLoop: loop(1000, 5000) })
      viewModel.setMode('silent')
      viewModel.toggle()
      // beats at 130, 630, 1130: the loop start at 1000 is 130 ms before the next beat
      expect(metronome.start).toHaveBeenLastCalledWith(120, 130)
      metronome.start.mockClear()
      clockOptions().onWrap()
      expect(metronome.start).toHaveBeenCalledWith(120, 130)
    })

    it('uses the latest bpm for loop laps', () => {
      update({ activeLoop: loop(1000, 5000) })
      viewModel.setMode('silent')
      viewModel.toggle()
      viewModel.setBpm(90)
      metronome.start.mockClear()
      clockOptions().onWrap()
      expect(metronome.start).toHaveBeenCalledWith(90)
    })
  })

  describe('silent practice', () => {
    beforeEach(() => {
      storage.getBpm.mockReturnValue(120)
      playTrack('1')
    })

    it('pauses Spotify when switching to silent and shows the start position', () => {
      update({ isPlaying: true })
      viewModel.setMode('silent')
      expect(player.togglePlay).toHaveBeenCalledTimes(1)
      expect(state().mode).toBe('silent')
      expect(practicePosition()).toBe(0)
    })

    it('does not touch Spotify when it is already paused', () => {
      viewModel.setMode('silent')
      expect(player.togglePlay).not.toHaveBeenCalled()
    })

    it('starts the clock and clicks from 0:00 without a loop', () => {
      viewModel.setMode('silent')
      viewModel.toggle()
      expect(state().isRunning).toBe(true)
      expect(clockOptions()).toMatchObject({ startMs: 0, loop: null, trackEndMs: 200_000 })
      expect(metronome.start).toHaveBeenCalledWith(120)
    })

    it('starts from the active loop and repeats it', () => {
      update({ activeLoop: loop(12_000, 20_000) })
      viewModel.setMode('silent')
      expect(practicePosition()).toBe(12_000)
      viewModel.toggle()
      expect(clockOptions()).toMatchObject({
        startMs: 12_000,
        loop: { startMs: 12_000, endMs: 20_000 },
      })
    })

    it('publishes clock positions to the lyrics', () => {
      viewModel.setMode('silent')
      viewModel.toggle()
      clockOptions().onPosition(4321)
      expect(practicePosition()).toBe(4321)
    })

    it('restarts the click grid on every loop lap', () => {
      update({ activeLoop: loop(1000, 5000) })
      viewModel.setMode('silent')
      viewModel.toggle()
      metronome.start.mockClear()
      clockOptions().onWrap()
      expect(metronome.start).toHaveBeenCalledWith(120)
    })

    it('stops at the end of the track and returns to the start position', () => {
      viewModel.setMode('silent')
      viewModel.toggle()
      clockOptions().onPosition(150_000)
      clockOptions().onEnd()
      expect(state().isRunning).toBe(false)
      expect(metronome.stop).toHaveBeenCalled()
      expect(practicePosition()).toBe(0)
    })

    it('starts clock and clicks from a clicked lyric line', () => {
      viewModel.setMode('silent')
      viewModel.playFromLyricLine(31_000)
      expect(state().isRunning).toBe(true)
      expect(clockOptions()).toMatchObject({ startMs: 31_000, loop: null })
      expect(metronome.start).toHaveBeenCalledWith(120)
    })

    it('jumps to another clicked line while running', () => {
      viewModel.setMode('silent')
      viewModel.playFromLyricLine(31_000)
      clock.start.mockClear()
      viewModel.playFromLyricLine(45_000)
      expect(clockOptions().startMs).toBe(45_000)
    })

    it('only moves the start position when there is no bpm to click at', () => {
      storage.getBpm.mockReturnValue(null)
      bpmService.getBpm.mockResolvedValue(null)
      playTrack('2')
      viewModel.setMode('silent')
      viewModel.playFromLyricLine(31_000)
      expect(practicePosition()).toBe(31_000)
      expect(state().isRunning).toBe(false)
      expect(clock.start).not.toHaveBeenCalled()
    })

    it('ignores clicked lines while a loop is active', () => {
      update({ activeLoop: loop(12_000, 20_000) })
      viewModel.setMode('silent')
      viewModel.playFromLyricLine(31_000)
      expect(practicePosition()).toBe(12_000)
      expect(state().isRunning).toBe(false)
      expect(player.seek).not.toHaveBeenCalled()
    })

    it('goes back to the clicked line once the loop is removed', () => {
      viewModel.setMode('silent')
      viewModel.playFromLyricLine(31_000)
      viewModel.toggle()
      update({ activeLoop: loop(12_000, 20_000) })
      expect(practicePosition()).toBe(12_000)
      update({ activeLoop: null })
      expect(practicePosition()).toBe(31_000)
    })

    it('restarts from the loop start when a loop is activated while running', () => {
      viewModel.setMode('silent')
      viewModel.toggle()
      clock.start.mockClear()
      update({ activeLoop: loop(8000, 16_000) })
      expect(clockOptions()).toMatchObject({
        startMs: 8000,
        loop: { startMs: 8000, endMs: 16_000 },
      })
    })

    it('keeps running without the loop when it is removed', () => {
      update({ activeLoop: loop(8000, 16_000) })
      viewModel.setMode('silent')
      viewModel.toggle()
      clock.start.mockClear()
      update({ activeLoop: null })
      expect(clock.setLoop).toHaveBeenCalledWith(null)
      expect(clock.start).not.toHaveBeenCalled()
    })

    it('returns to playing with the song when Spotify starts', () => {
      viewModel.setMode('silent')
      viewModel.toggle()
      update({ isPlaying: true })
      expect(state()).toMatchObject({ mode: 'withSong', isRunning: false })
      expect(practicePosition()).toBeNull()
      expect(clock.stop).toHaveBeenCalled()
    })

    it('keeps silent mode and resets the position when the track changes', () => {
      viewModel.setMode('silent')
      viewModel.playFromLyricLine(31_000)
      playTrack('2')
      expect(state().mode).toBe('silent')
      expect(practicePosition()).toBe(0)
    })

    it('stops the clock when nothing is subscribed any more', () => {
      viewModel.setMode('silent')
      viewModel.toggle()
      clock.stop.mockClear()
      unsubscribe()
      expect(clock.stop).toHaveBeenCalled()
    })
  })

  describe('restart and seeking', () => {
    beforeEach(() => {
      storage.getBpm.mockReturnValue(120)
      playTrack('1', { isPlaying: true })
    })

    it('restarts the song from the beginning and resumes when paused', async () => {
      update({ isPlaying: false })
      viewModel.restart()
      await flush()
      expect(player.seek).toHaveBeenCalledWith(0)
      expect(player.togglePlay).toHaveBeenCalledTimes(1)
    })

    it('restarts from the active loop start', async () => {
      update({ activeLoop: loop(12_000, 20_000) })
      viewModel.restart()
      await flush()
      expect(player.seek).toHaveBeenCalledWith(12_000)
      expect(player.togglePlay).not.toHaveBeenCalled()
    })

    it('restarts from the lyric line the song was started from', async () => {
      viewModel.playFromLyricLine(31_000)
      await flush()
      player.seek.mockClear()
      viewModel.restart()
      await flush()
      expect(player.seek).toHaveBeenCalledWith(31_000)
    })

    it('forgets the line when the track changes', async () => {
      viewModel.playFromLyricLine(31_000)
      await flush()
      playTrack('2', { isPlaying: true })
      player.seek.mockClear()
      viewModel.restart()
      await flush()
      expect(player.seek).toHaveBeenCalledWith(0)
    })

    it('restarts a silent session from the loop start, line or beginning', () => {
      viewModel.setMode('silent')
      viewModel.restart()
      expect(state().isRunning).toBe(true)
      expect(clockOptions().startMs).toBe(0)

      viewModel.playFromLyricLine(31_000)
      clock.start.mockClear()
      viewModel.restart()
      expect(clockOptions().startMs).toBe(31_000)
    })

    it('only shows the start position when silent without a bpm', () => {
      storage.getBpm.mockReturnValue(null)
      bpmService.getBpm.mockResolvedValue(null)
      playTrack('2')
      viewModel.setMode('silent')
      viewModel.restart()
      expect(state().isRunning).toBe(false)
      expect(clock.start).not.toHaveBeenCalled()
    })

    it('seeks the running silent clock and realigns the clicks', () => {
      viewModel.setMode('silent')
      viewModel.toggle()
      metronome.start.mockClear()
      viewModel.seekTo(45_000)
      expect(clock.seekTo).toHaveBeenCalledWith(45_000)
      expect(metronome.start).toHaveBeenCalledWith(120)
    })

    it('moves the start position when silent and stopped, unless a loop decides', () => {
      viewModel.setMode('silent')
      viewModel.seekTo(5000)
      expect(practicePosition()).toBe(5000)
      expect(viewModel.currentPracticePositionMs()).toBe(5000)

      update({ activeLoop: loop(12_000, 20_000) })
      viewModel.seekTo(7000)
      expect(practicePosition()).toBe(12_000)
    })

    it('does not seek when the song drives and has no practice position', () => {
      viewModel.seekTo(5000)
      expect(clock.seekTo).not.toHaveBeenCalled()
      expect(viewModel.currentPracticePositionMs()).toBeNull()
    })
  })

  describe('silent practice across track changes', () => {
    beforeEach(() => {
      storage.getBpm.mockReturnValue(120)
      playTrack('1')
      viewModel.setMode('silent')
      viewModel.toggle()
      clock.start.mockClear()
      metronome.start.mockClear()
    })

    it('carries on with the new track when its bpm is stored', () => {
      storage.getBpm.mockReturnValue(90)
      playTrack('2')
      expect(state()).toMatchObject({ mode: 'silent', isRunning: true, bpm: 90 })
      expect(clockOptions()).toMatchObject({ startMs: 0, loop: null })
      expect(metronome.start).toHaveBeenCalledWith(90)
    })

    it('waits for the fetched bpm and then carries on', async () => {
      storage.getBpm.mockReturnValue(null)
      let resolveLookup: (tempo: number) => void = () => {}
      bpmService.getBpm.mockReturnValueOnce(new Promise((resolve) => (resolveLookup = resolve)))
      playTrack('2')
      expect(state()).toMatchObject({ isRunning: false, lookupStatus: 'loading' })
      expect(clock.start).not.toHaveBeenCalled()

      resolveLookup(100)
      await vi.waitFor(() => expect(state().isRunning).toBe(true))
      expect(state().bpm).toBe(100)
      expect(clock.start).toHaveBeenCalledTimes(1)
    })

    it('stays stopped when no bpm is found, and starts once the user sets one', async () => {
      storage.getBpm.mockReturnValue(null)
      bpmService.getBpm.mockResolvedValueOnce(null)
      playTrack('2')
      await vi.waitFor(() => expect(state().lookupStatus).toBe('notFound'))
      expect(state().isRunning).toBe(false)

      viewModel.setBpm(110)
      expect(state()).toMatchObject({ isRunning: true, bpm: 110 })
      expect(clock.start).toHaveBeenCalledTimes(1)
    })

    it('does not start a session that was stopped before the track changed', () => {
      viewModel.toggle()
      clock.start.mockClear()
      playTrack('2')
      expect(state().isRunning).toBe(false)
      expect(clock.start).not.toHaveBeenCalled()
    })

    it('does not resume after the user stops or changes mode while the bpm loads', async () => {
      storage.getBpm.mockReturnValue(null)
      let resolveLookup: (tempo: number) => void = () => {}
      bpmService.getBpm.mockReturnValueOnce(new Promise((resolve) => (resolveLookup = resolve)))
      playTrack('2')
      viewModel.setMode('withSong')
      resolveLookup(100)
      await vi.waitFor(() => expect(state().bpm).toBe(100))
      expect(clock.start).not.toHaveBeenCalled()
      expect(state().isRunning).toBe(false)
    })

    it('goes back to the song, without a silent session, when Spotify plays the new track', () => {
      storage.getBpm.mockReturnValue(90)
      playTrack('2', { isPlaying: true })
      expect(state().mode).toBe('withSong')
      expect(clock.start).not.toHaveBeenCalled()
    })
  })

  describe('clicking a lyric line while clicking along', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(1_000_000)
      storage.getBpm.mockReturnValue(120) // 500 ms per beat
      playTrack('1', { isPlaying: true })
      viewModel.toggle()
    })

    afterEach(() => vi.useRealTimers())

    it('puts a click on the line when there is no tapped sync', async () => {
      await flush()
      metronome.start.mockClear()
      viewModel.playFromLyricLine(31_000)
      await flush()
      expect(metronome.start).toHaveBeenCalledTimes(1)
      expect(metronome.start).toHaveBeenCalledWith(120, 0)
    })

    it('uses the line it sought to instead of asking Spotify for a possibly stale position', async () => {
      await flush()
      metronome.start.mockClear()
      player.getCurrentPositionMs.mockClear()
      player.getCurrentPositionMs.mockResolvedValue(5)
      viewModel.playFromLyricLine(31_000)
      await flush()
      expect(player.getCurrentPositionMs).not.toHaveBeenCalled()
      expect(metronome.start).toHaveBeenCalledWith(120, 0)
    })

    it('accounts for the time that passed since the seek finished', async () => {
      await flush()
      metronome.start.mockClear()
      viewModel.playFromLyricLine(31_000)
      await flush()
      metronome.start.mockClear()
      // a later realignment with the same anchor sits on the same grid
      player.getCurrentPositionMs.mockResolvedValue(31_120)
      update({ activeLoop: loop(31_000, 40_000) })
      await flush()
      expect(metronome.start).toHaveBeenLastCalledWith(120, 380)
    })

    it('stays on the synced grid when one exists', async () => {
      storage.getBeatOffsetMs.mockReturnValue(130)
      playTrack('2', { isPlaying: true })
      viewModel.toggle()
      await flush()
      metronome.start.mockClear()
      viewModel.playFromLyricLine(31_000)
      await flush()
      // beats at 130 + n * 500: the next one after 31000 is 130 ms away
      expect(metronome.start).toHaveBeenLastCalledWith(120, 130)
    })

    it('an active loop still decides where the grid starts', async () => {
      update({ activeLoop: loop(10_250, 20_000) })
      await flush()
      metronome.start.mockClear()
      player.getCurrentPositionMs.mockResolvedValue(10_600)
      viewModel.restart()
      await flush()
      expect(metronome.start).toHaveBeenLastCalledWith(120, 0)
    })

    it('keeps clicking when the seek resumes a paused song before Spotify reports it', async () => {
      update({ isPlaying: false })
      await flush()
      metronome.start.mockClear()
      metronome.stop.mockClear()
      viewModel.playFromLyricLine(31_000)
      await flush()
      expect(player.togglePlay).toHaveBeenCalledTimes(1)
      expect(metronome.start).toHaveBeenCalledWith(120, 0)
    })

    it('ignores Spotify reports of the jump while the seek is still in flight', async () => {
      await flush()
      metronome.start.mockClear()
      player.getCurrentPositionMs.mockClear()
      let finishSeek: () => void = () => {}
      player.seek.mockReturnValueOnce(new Promise<void>((resolve) => (finishSeek = resolve)))
      viewModel.playFromLyricLine(31_000)
      update({ positionMs: 31_000 })
      vi.advanceTimersByTime(600)
      update({ positionMs: 31_600 })
      await flush()
      expect(metronome.start).not.toHaveBeenCalled()
      expect(player.getCurrentPositionMs).not.toHaveBeenCalled()

      finishSeek()
      await flush()
      expect(metronome.start).toHaveBeenCalledTimes(1)
    })

    it('only the latest of two quick line clicks realigns', async () => {
      await flush()
      metronome.start.mockClear()
      let finishFirst: () => void = () => {}
      player.seek
        .mockReturnValueOnce(new Promise<void>((resolve) => (finishFirst = resolve)))
        .mockResolvedValueOnce(undefined)
      viewModel.playFromLyricLine(10_000)
      viewModel.playFromLyricLine(31_000)
      await flush()
      finishFirst()
      await flush()
      expect(metronome.start).toHaveBeenCalledTimes(1)
      expect(metronome.start).toHaveBeenCalledWith(120, 0)
    })

    it('does nothing for the clicks when the metronome is not running', async () => {
      viewModel.toggle()
      await flush()
      metronome.start.mockClear()
      viewModel.playFromLyricLine(31_000)
      await flush()
      expect(player.seek).toHaveBeenCalledWith(31_000)
      expect(metronome.start).not.toHaveBeenCalled()
    })
  })
})
