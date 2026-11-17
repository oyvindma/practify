import { describe, it, expect, beforeEach } from 'vitest'
import { BpmStorageService } from '../BpmStorageService'

const storage = new BpmStorageService()

beforeEach(() => localStorage.clear())

describe('BpmStorageService', () => {
  it('returns null when nothing is stored', () => {
    expect(storage.getBpm('t1')).toBeNull()
  })

  it('round-trips bpm per track under bpm_<trackId>', () => {
    storage.saveBpm('t1', 120)
    expect(storage.getBpm('t1')).toBe(120)
    expect(storage.getBpm('t2')).toBeNull()
    expect(localStorage.getItem('bpm_t1')).toBe('120')
  })

  it('returns null for corrupt data', () => {
    localStorage.setItem('bpm_t1', 'abc')
    expect(storage.getBpm('t1')).toBeNull()
  })

  it('stores beat offsets per track, including zero, and can clear them', () => {
    expect(storage.getBeatOffsetMs('t1')).toBeNull()
    storage.saveBeatOffsetMs('t1', 130.5)
    expect(storage.getBeatOffsetMs('t1')).toBe(130.5)
    expect(localStorage.getItem('beatoffset_t1')).toBe('130.5')
    storage.saveBeatOffsetMs('t1', 0)
    expect(storage.getBeatOffsetMs('t1')).toBe(0)
    storage.clearBeatOffsetMs('t1')
    expect(storage.getBeatOffsetMs('t1')).toBeNull()
  })

  it('returns null for corrupt or negative offsets', () => {
    localStorage.setItem('beatoffset_t1', 'abc')
    expect(storage.getBeatOffsetMs('t1')).toBeNull()
    localStorage.setItem('beatoffset_t1', '-5')
    expect(storage.getBeatOffsetMs('t1')).toBeNull()
  })
})
