import { describe, it, expect } from 'vitest'
import { findActiveLineIndex, parsePlainLyrics, parseSyncedLyrics, type Lyrics } from '../lyrics'

describe('parseSyncedLyrics', () => {
  it('parses timestamps into milliseconds', () => {
    const lines = parseSyncedLyrics('[00:17.12] First line\n[03:20.3] Last line')
    expect(lines).toEqual([
      { startMs: 17_120, text: 'First line' },
      { startMs: 200_300, text: 'Last line' },
    ])
  })

  it('keeps empty instrumental lines and skips metadata tags', () => {
    const lines = parseSyncedLyrics('[ar: Someone]\n[00:01.00] \n[00:02.00] Hi')
    expect(lines).toEqual([
      { startMs: 1000, text: '' },
      { startMs: 2000, text: 'Hi' },
    ])
  })

  it('sorts lines by start time', () => {
    const lines = parseSyncedLyrics('[00:05.00] B\n[00:01.00] A')
    expect(lines.map((l) => l.text)).toEqual(['A', 'B'])
  })
})

describe('parsePlainLyrics', () => {
  it('splits into untimed lines', () => {
    expect(parsePlainLyrics('a\nb')).toEqual([
      { startMs: null, text: 'a' },
      { startMs: null, text: 'b' },
    ])
  })
})

describe('findActiveLineIndex', () => {
  const lyrics: Lyrics = {
    synced: true,
    lines: [
      { startMs: 1000, text: 'a' },
      { startMs: 2000, text: 'b' },
    ],
  }

  it('is -1 before the first line', () => {
    expect(findActiveLineIndex(lyrics, 500)).toBe(-1)
  })

  it('picks the last line that has started', () => {
    expect(findActiveLineIndex(lyrics, 1000)).toBe(0)
    expect(findActiveLineIndex(lyrics, 2500)).toBe(1)
  })

  it('is -1 for plain or missing lyrics', () => {
    expect(findActiveLineIndex(null, 1000)).toBe(-1)
    expect(findActiveLineIndex({ synced: false, lines: [] }, 1000)).toBe(-1)
  })
})
