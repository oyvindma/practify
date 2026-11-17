import { describe, it, expect } from 'vitest'
import { beatIntervalMs, bpmFromTaps, clampBpm } from '../metronome'

describe('clampBpm', () => {
  it('rounds to whole numbers', () => {
    expect(clampBpm(171.001)).toBe(171)
    expect(clampBpm(95.977)).toBe(96)
  })

  it('clamps to 30-300', () => {
    expect(clampBpm(5)).toBe(30)
    expect(clampBpm(999)).toBe(300)
  })
})

describe('beatIntervalMs', () => {
  it('converts bpm to milliseconds per beat', () => {
    expect(beatIntervalMs(120)).toBe(500)
    expect(beatIntervalMs(60)).toBe(1000)
  })
})

describe('bpmFromTaps', () => {
  it('needs at least two taps', () => {
    expect(bpmFromTaps([])).toBeNull()
    expect(bpmFromTaps([1000])).toBeNull()
  })

  it('averages the tap intervals', () => {
    expect(bpmFromTaps([0, 500, 1000, 1500])).toBe(120)
    expect(bpmFromTaps([0, 600, 1200])).toBe(100)
  })

  it('only uses the most recent taps', () => {
    const slowThenFast = [0, 2000, 4000, 4500, 5000, 5500, 6000, 6500, 7000, 7500]
    expect(bpmFromTaps(slowThenFast)).toBe(120)
  })

  it('returns null when taps share a timestamp', () => {
    expect(bpmFromTaps([1000, 1000])).toBeNull()
  })
})
