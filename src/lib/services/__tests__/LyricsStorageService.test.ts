import { describe, it, expect, beforeEach } from 'vitest'
import type { Lyrics } from '$lib/models/lyrics'
import { LyricsStorageService } from '../LyricsStorageService'

const lyrics: Lyrics = { synced: true, lines: [{ startMs: 1000, text: 'a' }] }
const storage = new LyricsStorageService()

beforeEach(() => localStorage.clear())

describe('LyricsStorageService', () => {
  it('returns null when nothing is stored', () => {
    expect(storage.getLyrics('t1')).toBeNull()
  })

  it('round-trips lyrics per track under lyrics_<trackId>', () => {
    storage.saveLyrics('t1', lyrics)
    expect(storage.getLyrics('t1')).toEqual(lyrics)
    expect(storage.getLyrics('t2')).toBeNull()
    expect(localStorage.getItem('lyrics_t1')).not.toBeNull()
  })

  it('returns null for corrupt data', () => {
    localStorage.setItem('lyrics_t1', '{not json')
    expect(storage.getLyrics('t1')).toBeNull()
  })
})
