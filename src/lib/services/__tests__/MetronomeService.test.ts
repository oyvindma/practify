import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { WebAudioMetronomeService } from '../MetronomeService'

let currentTime: number
let clickStartTimes: number[]

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
      start: (time: number) => clickStartTimes.push(time),
      stop: vi.fn(),
    }
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  currentTime = 0
  clickStartTimes = []
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
})
