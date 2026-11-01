import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest'
import type { PlaybackSnapshot } from '$lib/services/SpotifyPlayerService'
import { LoopEngine } from '../LoopEngine'

describe('LoopEngine', () => {
  let snapshot: PlaybackSnapshot | null
  let source: {
    getPlaybackSnapshot: Mock<() => Promise<PlaybackSnapshot | null>>
    seek: Mock<(positionMs: number) => Promise<void>>
  }
  let onPosition: Mock<(positionMs: number) => void>
  let engine: LoopEngine

  const at = (positionMs: number, isPaused = false): PlaybackSnapshot => ({
    positionMs,
    durationMs: 100_000,
    isPaused,
  })

  beforeEach(() => {
    vi.useFakeTimers()
    snapshot = at(0)
    source = {
      getPlaybackSnapshot: vi.fn(async () => snapshot),
      seek: vi.fn().mockResolvedValue(undefined),
    }
    onPosition = vi.fn()
    engine = new LoopEngine(source, onPosition)
  })

  afterEach(() => {
    engine.dispose()
    vi.useRealTimers()
  })

  describe('progress tracking', () => {
    it('polls every 500 ms while playing', async () => {
      engine.setPlaying(true)
      snapshot = at(7000)
      await vi.advanceTimersByTimeAsync(500)
      expect(onPosition).toHaveBeenCalledWith(7000)
    })

    it('ignores paused snapshots', async () => {
      engine.setPlaying(true)
      snapshot = at(7000, true)
      await vi.advanceTimersByTimeAsync(1000)
      expect(onPosition).not.toHaveBeenCalled()
    })

    it('does not poll when not playing', async () => {
      await vi.advanceTimersByTimeAsync(2000)
      expect(source.getPlaybackSnapshot).not.toHaveBeenCalled()
    })

    it('stops polling when playback pauses', async () => {
      engine.setPlaying(true)
      engine.setPlaying(false)
      await vi.advanceTimersByTimeAsync(2000)
      expect(source.getPlaybackSnapshot).not.toHaveBeenCalled()
    })

    it('does not start a second poll when told it is playing twice', async () => {
      engine.setPlaying(true)
      engine.setPlaying(true)
      await vi.advanceTimersByTimeAsync(500)
      expect(source.getPlaybackSnapshot).toHaveBeenCalledTimes(1)
    })
  })

  describe('looping', () => {
    it('seeks to the start and reports it is looping', () => {
      engine.startLoop({ startMs: 10_000, endMs: 20_000 })
      expect(engine.isLooping).toBe(true)
      expect(source.seek).toHaveBeenCalledWith(10_000)
    })

    it('can start from another position', () => {
      engine.startLoop({ startMs: 10_000, endMs: 20_000 }, 18_000)
      expect(source.seek).toHaveBeenCalledWith(18_000)
    })

    it('replaces progress polling with loop polling', async () => {
      engine.setPlaying(true)
      engine.startLoop({ startMs: 10_000, endMs: 20_000 })
      source.getPlaybackSnapshot.mockClear()
      snapshot = at(12_000)
      await vi.advanceTimersByTimeAsync(500)
      expect(source.getPlaybackSnapshot).toHaveBeenCalledTimes(6)
    })

    it('seeks back to the start when the end is reached', async () => {
      engine.startLoop({ startMs: 10_000, endMs: 20_000 })
      await vi.advanceTimersByTimeAsync(0)
      source.seek.mockClear()

      snapshot = at(15_000)
      await vi.advanceTimersByTimeAsync(100)
      expect(source.seek).not.toHaveBeenCalled()
      expect(onPosition).toHaveBeenLastCalledWith(15_000)

      snapshot = at(20_050)
      await vi.advanceTimersByTimeAsync(100)
      expect(source.seek).toHaveBeenCalledWith(10_000)
    })

    it('does not seek while paused, even past the end', async () => {
      engine.startLoop({ startMs: 10_000, endMs: 20_000 })
      await vi.advanceTimersByTimeAsync(0)
      source.seek.mockClear()
      snapshot = at(25_000, true)
      await vi.advanceTimersByTimeAsync(500)
      expect(source.seek).not.toHaveBeenCalled()
    })

    it('does not issue another seek while one is still in flight', async () => {
      let finishSeek: () => void = () => {}
      engine.startLoop({ startMs: 10_000, endMs: 20_000 })
      await vi.advanceTimersByTimeAsync(0)
      source.seek.mockClear()
      source.seek.mockReturnValueOnce(new Promise<void>((resolve) => (finishSeek = resolve)))

      snapshot = at(20_100)
      await vi.advanceTimersByTimeAsync(500)
      expect(source.seek).toHaveBeenCalledTimes(1)

      finishSeek()
      await vi.advanceTimersByTimeAsync(100)
      expect(source.seek).toHaveBeenCalledTimes(2)
    })

    it('survives a failing seek', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      source.seek.mockRejectedValueOnce(new Error('seek failed'))
      engine.startLoop({ startMs: 10_000, endMs: 20_000 })
      await vi.advanceTimersByTimeAsync(300)
      expect(warn).toHaveBeenCalled()
      snapshot = at(21_000)
      await vi.advanceTimersByTimeAsync(100)
      expect(source.seek).toHaveBeenLastCalledWith(10_000)
      warn.mockRestore()
    })

    it('keeps polling when the player briefly has no state', async () => {
      engine.startLoop({ startMs: 10_000, endMs: 20_000 })
      snapshot = null
      await vi.advanceTimersByTimeAsync(300)
      snapshot = at(21_000)
      source.seek.mockClear()
      await vi.advanceTimersByTimeAsync(100)
      expect(source.seek).toHaveBeenCalledWith(10_000)
    })

    it('runs a single poll chain when a loop is replaced', async () => {
      engine.startLoop({ startMs: 10_000, endMs: 20_000 })
      engine.startLoop({ startMs: 30_000, endMs: 40_000 })
      await vi.advanceTimersByTimeAsync(0)
      source.getPlaybackSnapshot.mockClear()
      await vi.advanceTimersByTimeAsync(1000)
      expect(source.getPlaybackSnapshot).toHaveBeenCalledTimes(10)
    })

    it('stops polling and resumes progress tracking when the loop stops', async () => {
      engine.setPlaying(true)
      engine.startLoop({ startMs: 10_000, endMs: 20_000 })
      engine.stopLoop()
      expect(engine.isLooping).toBe(false)
      source.seek.mockClear()
      source.getPlaybackSnapshot.mockClear()
      snapshot = at(30_000)
      await vi.advanceTimersByTimeAsync(500)
      expect(source.seek).not.toHaveBeenCalled()
      expect(source.getPlaybackSnapshot).toHaveBeenCalledTimes(1)
    })

    it('ignores a poll that was in flight when the loop was stopped', async () => {
      engine.startLoop({ startMs: 10_000, endMs: 20_000 })
      await vi.advanceTimersByTimeAsync(0)
      source.seek.mockClear()
      snapshot = at(30_000)
      vi.advanceTimersByTime(100)
      engine.stopLoop()
      await vi.advanceTimersByTimeAsync(0)
      expect(source.seek).not.toHaveBeenCalled()
    })
  })

  describe('updateLoop', () => {
    it('applies new bounds without seeking', async () => {
      engine.startLoop({ startMs: 10_000, endMs: 20_000 })
      await vi.advanceTimersByTimeAsync(0)
      source.seek.mockClear()

      engine.updateLoop({ startMs: 12_000, endMs: 14_000 })
      snapshot = at(15_000)
      await vi.advanceTimersByTimeAsync(0)
      expect(source.seek).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(100)
      expect(source.seek).toHaveBeenCalledWith(12_000)
    })

    it('does nothing when no loop is active', () => {
      engine.updateLoop({ startMs: 1, endMs: 2 })
      expect(engine.isLooping).toBe(false)
    })
  })

  describe('dispose', () => {
    it('stops everything', async () => {
      engine.setPlaying(true)
      engine.startLoop({ startMs: 10_000, endMs: 20_000 })
      engine.dispose()
      source.getPlaybackSnapshot.mockClear()
      await vi.advanceTimersByTimeAsync(2000)
      expect(source.getPlaybackSnapshot).not.toHaveBeenCalled()
      expect(engine.isLooping).toBe(false)
    })
  })
})
