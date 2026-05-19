import { describe, it, expect } from 'vitest'
import {
  formatMillisecondsAsMinutesAndSeconds,
  formatMillisecondsWithCentiseconds,
} from '../time'

describe('formatMillisecondsAsMinutesAndSeconds', () => {
  it('formats zero', () => {
    expect(formatMillisecondsAsMinutesAndSeconds(0)).toBe('0:00')
  })

  it('formats seconds', () => {
    expect(formatMillisecondsAsMinutesAndSeconds(5_000)).toBe('0:05')
  })

  it('formats minutes and seconds', () => {
    expect(formatMillisecondsAsMinutesAndSeconds(65_000)).toBe('1:05')
  })

  it('pads seconds to two digits', () => {
    expect(formatMillisecondsAsMinutesAndSeconds(3_000)).toBe('0:03')
  })

  it('handles large values', () => {
    expect(formatMillisecondsAsMinutesAndSeconds(600_000)).toBe('10:00')
  })

  it('truncates milliseconds without rounding', () => {
    expect(formatMillisecondsAsMinutesAndSeconds(1_999)).toBe('0:01')
  })
})

describe('formatMillisecondsWithCentiseconds', () => {
  it('formats zero', () => {
    expect(formatMillisecondsWithCentiseconds(0)).toBe('0:00.00')
  })

  it('includes centiseconds', () => {
    expect(formatMillisecondsWithCentiseconds(1_230)).toBe('0:01.23')
  })

  it('pads centiseconds to two digits', () => {
    expect(formatMillisecondsWithCentiseconds(5_050)).toBe('0:05.05')
  })

  it('formats minutes, seconds, and centiseconds', () => {
    expect(formatMillisecondsWithCentiseconds(125_670)).toBe('2:05.67')
  })

  it('truncates sub-centisecond precision', () => {
    expect(formatMillisecondsWithCentiseconds(1_999)).toBe('0:01.99')
  })
})
