import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { WebAudioMetronomeService } from '../MetronomeService'

let currentTime: number
let clickStartTimes: number[]
let stopCalls: (number | undefined)[]

class FakeAudioContext {
  destination = {}
  get currentTime() {
    return currentTime
  }
  resume = vi.fn().mockResolvedValue(undefined)
  createGain() {
    return {
      gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
    }
  }
  createOscillator() {
    return {
      frequency: { value: 0 },
      connect: vi.fn(),
      onended: null as (() => void) | null,
      start: (time: number) => clickStartTimes.push(time),
      stop: (when?: number) => stopCalls.push(when),
    }
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  currentTime = 0
  clickStartTimes = []
  stopCalls = []
  vi.stubGlobal('AudioContext', FakeAudioContext)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function advanceSeconds(seconds: number) {
  for (let elapsed = 0; elapsed < seconds; elapsed += 0.025) {
    currentTime += 0.025
    vi.advanceTimersByTime(25)
  }
}

describe('WebAudioMetronomeService', () => {
  it('schedules clicks one beat apart', () => {
    const metronome = new WebAudioMetronomeService()
    metronome.start(120)
    advanceSeconds(1.2)
    const gaps = clickStartTimes.slice(1).map((time, i) => time - clickStartTimes[i])
    expect(clickStartTimes.length).toBeGreaterThanOrEqual(3)
    gaps.forEach((gap) => expect(gap).toBeCloseTo(0.5, 5))
    metronome.stop()
  })

  it('uses the new tempo after setBpm', () => {
    const metronome = new WebAudioMetronomeService()
    metronome.start(60)
    advanceSeconds(0.3)
    metronome.setBpm(120)
    clickStartTimes.length = 0
    advanceSeconds(3)
    const gaps = clickStartTimes.slice(1).map((time, i) => time - clickStartTimes[i])
    expect(gaps.at(-1)).toBeCloseTo(0.5, 5)
    metronome.stop()
  })

  it('stops scheduling after stop', () => {
    const metronome = new WebAudioMetronomeService()
    metronome.start(120)
    advanceSeconds(0.3)
    metronome.stop()
    const count = clickStartTimes.length
    advanceSeconds(2)
    expect(clickStartTimes).toHaveLength(count)
  })

  it('delays the first click to align with the beat grid', () => {
    const metronome = new WebAudioMetronomeService()
    metronome.start(120, 300)
    expect(clickStartTimes).toEqual([])
    advanceSeconds(0.25)
    expect(clickStartTimes[0]).toBeCloseTo(0.3, 5)
    metronome.stop()
  })

  it('cancels clicks that were scheduled ahead when stopped', () => {
    const metronome = new WebAudioMetronomeService()
    metronome.start(120)
    advanceSeconds(0.1)
    stopCalls.length = 0
    metronome.stop()
    expect(stopCalls.length).toBeGreaterThan(0)
  })

  it('starts right away without a grid delay', () => {
    const metronome = new WebAudioMetronomeService()
    metronome.start(120)
    expect(clickStartTimes[0]).toBeCloseTo(0.05, 5)
    metronome.stop()
  })

  it('skips a beat that is too close instead of moving it, keeping the grid in phase', () => {
    const metronome = new WebAudioMetronomeService()
    metronome.start(120, 20)
    advanceSeconds(1.1)
    expect(clickStartTimes[0]).toBeCloseTo(0.52, 5)
    expect(clickStartTimes[1]).toBeCloseTo(1.02, 5)
    metronome.stop()
  })

  it('waits a whole beat when the grid beat is exactly now', () => {
    const metronome = new WebAudioMetronomeService()
    metronome.start(120, 0)
    advanceSeconds(0.6)
    expect(clickStartTimes[0]).toBeCloseTo(0.5, 5)
    metronome.stop()
  })
})
