import { describe, it, expect } from 'vitest'
import { adjustMs } from '../time'

describe('adjustMs', () => {
  it('increases value by positive delta', () => {
    expect(adjustMs(1000, 100)).toBe(1100)
  })

  it('decreases value by negative delta', () => {
    expect(adjustMs(1000, -100)).toBe(900)
  })

  it('clamps to 0 when delta would go negative', () => {
    expect(adjustMs(50, -100)).toBe(0)
  })

  it('returns 0 when both value and delta are 0', () => {
    expect(adjustMs(0, 0)).toBe(0)
  })

  it('returns value unchanged when delta is 0', () => {
    expect(adjustMs(5000, 0)).toBe(5000)
  })

  it('clamps exactly at 0 when result would be exactly 0', () => {
    expect(adjustMs(100, -100)).toBe(0)
  })

  it('works with large values', () => {
    expect(adjustMs(300_000, 100)).toBe(300_100)
  })
})
