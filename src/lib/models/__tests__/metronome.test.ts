import { describe, it, expect } from 'vitest'
import {
  beatIntervalMs,
  bpmFromTaps,
  clampBpm,
  estimateBeatOffsetMs,
  msUntilNextBeat,
  shiftBeatOffsetMs,
} from '../metronome'

describe('clampBpm', () => {
  it('keeps two decimals', () => {
    expect(clampBpm(171.001)).toBe(171)
    expect(clampBpm(95.977)).toBe(95.98)
    expect(clampBpm(148.114)).toBe(148.11)
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

describe('msUntilNextBeat', () => {
  it('is zero when exactly on a beat', () => {
    expect(msUntilNextBeat(1000, 0, 120)).toBe(0)
    expect(msUntilNextBeat(5000, 1000, 120)).toBe(0)
  })

  it('returns the time to the next beat after the anchor', () => {
    expect(msUntilNextBeat(1100, 0, 120)).toBe(400)
    expect(msUntilNextBeat(1100, 1000, 120)).toBe(400)
  })

  it('works for positions before the anchor', () => {
    expect(msUntilNextBeat(900, 1000, 120)).toBe(100)
  })
})

describe('estimateBeatOffsetMs', () => {
  const bpm = 120 // 500 ms per beat

  it('needs at least four taps', () => {
    expect(estimateBeatOffsetMs([130, 630, 1130], bpm)).toBeNull()
  })

  it('finds the offset of beats that start 130 ms into the song', () => {
    const offset = estimateBeatOffsetMs([130, 630, 1130, 1630, 2130], bpm)
    expect(offset).toBeCloseTo(130, 5)
  })

  it('averages out jitter across taps', () => {
    const offset = estimateBeatOffsetMs([140, 620, 1135, 1625, 2140, 2620], bpm)
    expect(offset).toBeGreaterThan(125)
    expect(offset).toBeLessThan(135)
  })

  it('is not thrown off when taps straddle the beat boundary', () => {
    const offset = estimateBeatOffsetMs([495, 1010, 1495, 2010], bpm)
    expect(offset! < 10 || offset! > 490).toBe(true)
  })

  it('accepts taps on every other beat', () => {
    expect(estimateBeatOffsetMs([130, 1130, 2130, 3130], bpm)).toBeCloseTo(130, 5)
  })

  it('returns null when the taps do not agree on a phase', () => {
    expect(estimateBeatOffsetMs([0, 125, 250, 375], bpm)).toBeNull()
  })
})

describe('shiftBeatOffsetMs', () => {
  it('shifts and wraps within one beat', () => {
    expect(shiftBeatOffsetMs(100, 10, 120)).toBe(110)
    expect(shiftBeatOffsetMs(495, 10, 120)).toBe(5)
    expect(shiftBeatOffsetMs(5, -10, 120)).toBe(495)
  })
})
