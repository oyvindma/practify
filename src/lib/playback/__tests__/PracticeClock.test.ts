import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import { PracticeClock } from '../PracticeClock'

describe('PracticeClock', () => {
  let nowMs: number
  let clock: PracticeClock
  let positions: number[]
  let onWrap: Mock<() => void>
  let onEnd: Mock<() => void>

  function advance(ms: number) {
    nowMs += ms
    vi.advanceTimersByTime(ms)
  }

  function start(overrides: Partial<Parameters<PracticeClock['start']>[0]> = {}) {
    clock.start({
      startMs: 0,
      loop: null,
      trackEndMs: 10_000,
      onPosition: (ms) => positions.push(ms),
      onWrap,
      onEnd,
      ...overrides,
    })
  }

  beforeEach(() => {
    vi.useFakeTimers()
    nowMs = 0
    clock = new PracticeClock(() => nowMs)
    positions = []
    onWrap = vi.fn()
    onEnd = vi.fn()
  })

  afterEach(() => {
    clock.stop()
    vi.useRealTimers()
  })

  it('reports the start position immediately and then advances in real time', () => {
    start({ startMs: 2000 })
    expect(positions).toEqual([2000])
    advance(100)
    expect(positions.at(-1)).toBe(2100)
  })

  it('stops reporting after stop', () => {
    start()
    clock.stop()
    positions.length = 0
    advance(500)
    expect(positions).toEqual([])
  })

  it('ends at the end of the track when there is no loop', () => {
    start({ startMs: 9000 })
    advance(999)
    expect(onEnd).not.toHaveBeenCalled()
    advance(1)
    expect(onEnd).toHaveBeenCalledTimes(1)
    positions.length = 0
    advance(500)
    expect(positions).toEqual([])
  })

  it('wraps to the loop start at the loop end', () => {
    start({ startMs: 1000, loop: { startMs: 1000, endMs: 3000 } })
    advance(2000)
    expect(onWrap).toHaveBeenCalledTimes(1)
    expect(onEnd).not.toHaveBeenCalled()
    expect(positions.at(-1)).toBe(1000)
    advance(100)
    expect(positions.at(-1)).toBe(1100)
    advance(1900)
    expect(onWrap).toHaveBeenCalledTimes(2)
  })

  it('ignores degenerate loops', () => {
    start({ startMs: 0, loop: { startMs: 5000, endMs: 5000 } })
    advance(1000)
    expect(onWrap).not.toHaveBeenCalled()
  })

  it('never ends when the track length is unknown', () => {
    start({ trackEndMs: 0 })
    advance(60_000)
    expect(onEnd).not.toHaveBeenCalled()
  })

  it('switches to a new loop from the current position', () => {
    start()
    advance(500)
    clock.setLoop({ startMs: 0, endMs: 1000 })
    advance(500)
    expect(onWrap).toHaveBeenCalledTimes(1)
  })

  it('wraps right away when the new loop ends before the current position', () => {
    start({ startMs: 4000 })
    clock.setLoop({ startMs: 1000, endMs: 2000 })
    advance(0)
    expect(onWrap).toHaveBeenCalledTimes(1)
    expect(positions.at(-1)).toBe(1000)
  })

  it('keeps running to the end of the track when the loop is removed', () => {
    start({ startMs: 0, loop: { startMs: 0, endMs: 1000 } })
    advance(500)
    clock.setLoop(null)
    advance(1000)
    expect(onWrap).not.toHaveBeenCalled()
    advance(8500)
    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  it('continues from a new position after seekTo', () => {
    start({ startMs: 1000 })
    advance(500)
    clock.seekTo(5000)
    expect(positions.at(-1)).toBe(5000)
    advance(100)
    expect(positions.at(-1)).toBe(5100)
  })

  it('ends at the track end measured from the seeked position', () => {
    start({ startMs: 0 })
    clock.seekTo(9500)
    advance(499)
    expect(onEnd).not.toHaveBeenCalled()
    advance(1)
    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  it('wraps when seeking past the loop end', () => {
    start({ startMs: 1000, loop: { startMs: 1000, endMs: 3000 } })
    clock.seekTo(3500)
    advance(0)
    expect(onWrap).toHaveBeenCalledTimes(1)
    expect(positions.at(-1)).toBe(1000)
  })

  it('ignores seekTo when stopped', () => {
    clock.seekTo(5000)
    expect(positions).toEqual([])
  })
})
