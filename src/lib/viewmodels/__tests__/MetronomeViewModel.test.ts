import { describe, it, expect, beforeEach, vi } from 'vitest'
import { get, writable } from 'svelte/store'
import { INITIAL_PLAYER_STATE, type PlayerState } from '$lib/models/player'
import type { SpotifyTrack } from '$lib/models/spotify'
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

describe('MetronomeViewModel', () => {
  let playerState: ReturnType<typeof writable<PlayerState>>
  let bpmService: { getBpm: ReturnType<typeof vi.fn> }
  let storage: { getBpm: ReturnType<typeof vi.fn>; saveBpm: ReturnType<typeof vi.fn> }
  let metronome: {
    start: ReturnType<typeof vi.fn>
    setBpm: ReturnType<typeof vi.fn>
    stop: ReturnType<typeof vi.fn>
  }
  let viewModel: MetronomeViewModel
  let unsubscribe: () => void

  const state = () => get(viewModel.metronomeState)
  const playTrack = (id: string) => playerState.update((s) => ({ ...s, track: makeTrack(id) }))

  beforeEach(() => {
    playerState = writable({ ...INITIAL_PLAYER_STATE })
    bpmService = { getBpm: vi.fn().mockResolvedValue(171.001) }
    storage = { getBpm: vi.fn().mockReturnValue(null), saveBpm: vi.fn() }
    metronome = { start: vi.fn(), setBpm: vi.fn(), stop: vi.fn() }
    viewModel = createMetronomeViewModel(
      { playerState },
      bpmService as never,
      storage as never,
      metronome as never,
    )
    unsubscribe = viewModel.metronomeState.subscribe(() => {})
  })

  describe('loading bpm', () => {
    it('is idle without a track', () => {
      expect(state()).toEqual({ bpm: null, isRunning: false, lookupStatus: 'idle' })
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
      expect(state()).toEqual({ bpm: 90, isRunning: false, lookupStatus: 'found' })
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

    it('clamps, stores and retimes a running metronome', () => {
      viewModel.toggle()
      viewModel.setBpm(500)
      expect(state().bpm).toBe(300)
      expect(storage.saveBpm).toHaveBeenCalledWith('1', 300)
      expect(metronome.setBpm).toHaveBeenCalledWith(300)
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

  describe('start and stop', () => {
    it('does nothing without a bpm', () => {
      viewModel.toggle()
      expect(metronome.start).not.toHaveBeenCalled()
      expect(state().isRunning).toBe(false)
    })

    it('starts and stops the metronome', () => {
      storage.getBpm.mockReturnValue(120)
      playTrack('1')
      viewModel.toggle()
      expect(metronome.start).toHaveBeenCalledWith(120)
      expect(state().isRunning).toBe(true)
      viewModel.toggle()
      expect(metronome.stop).toHaveBeenCalled()
      expect(state().isRunning).toBe(false)
    })

    it('stops when the track changes', () => {
      storage.getBpm.mockReturnValue(120)
      playTrack('1')
      viewModel.toggle()
      playTrack('2')
      expect(state().isRunning).toBe(false)
      expect(metronome.stop).toHaveBeenCalled()
    })

    it('stops when nothing is subscribed any more', () => {
      storage.getBpm.mockReturnValue(120)
      playTrack('1')
      viewModel.toggle()
      metronome.stop.mockClear()
      unsubscribe()
      expect(metronome.stop).toHaveBeenCalled()
    })
  })
})
