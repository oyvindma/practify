import { describe, it, expect, beforeEach } from 'vitest'
import { getBookmarks, saveBookmark, deleteBookmark, updateBookmark } from '../store'

const TRACK_ID = 'track-abc-123'

beforeEach(() => localStorage.clear())

describe('getBookmarks', () => {
  it('returns empty array when no bookmarks exist', () => {
    expect(getBookmarks(TRACK_ID)).toEqual([])
  })

  it('returns saved bookmarks for a track', () => {
    saveBookmark(TRACK_ID, { name: 'Vers 1', startMs: 0, endMs: 30_000 })
    const bms = getBookmarks(TRACK_ID)
    expect(bms).toHaveLength(1)
    expect(bms[0].name).toBe('Vers 1')
  })
})

describe('saveBookmark', () => {
  it('assigns a unique id to each bookmark', () => {
    const a = saveBookmark(TRACK_ID, { name: 'A', startMs: 0, endMs: 5000 })
    const b = saveBookmark(TRACK_ID, { name: 'B', startMs: 5000, endMs: 10_000 })
    expect(a.id).not.toBe(b.id)
  })

  it('persists bookmark with correct trackId', () => {
    const bm = saveBookmark(TRACK_ID, { name: 'Bro', startMs: 60_000, endMs: 90_000 })
    expect(bm.trackId).toBe(TRACK_ID)
  })

  it('accumulates multiple bookmarks', () => {
    saveBookmark(TRACK_ID, { name: 'A', startMs: 0, endMs: 10_000 })
    saveBookmark(TRACK_ID, { name: 'B', startMs: 10_000, endMs: 20_000 })
    expect(getBookmarks(TRACK_ID)).toHaveLength(2)
  })

  it('does not mix bookmarks across tracks', () => {
    saveBookmark(TRACK_ID, { name: 'A', startMs: 0, endMs: 5000 })
    saveBookmark('other-track', { name: 'B', startMs: 0, endMs: 5000 })
    expect(getBookmarks(TRACK_ID)).toHaveLength(1)
    expect(getBookmarks('other-track')).toHaveLength(1)
  })
})

describe('deleteBookmark', () => {
  it('removes the bookmark with matching id', () => {
    const bm = saveBookmark(TRACK_ID, { name: 'Solo', startMs: 120_000, endMs: 150_000 })
    deleteBookmark(TRACK_ID, bm.id)
    expect(getBookmarks(TRACK_ID)).toHaveLength(0)
  })

  it('leaves other bookmarks untouched', () => {
    const a = saveBookmark(TRACK_ID, { name: 'A', startMs: 0, endMs: 5000 })
    saveBookmark(TRACK_ID, { name: 'B', startMs: 5000, endMs: 10_000 })
    deleteBookmark(TRACK_ID, a.id)
    const remaining = getBookmarks(TRACK_ID)
    expect(remaining).toHaveLength(1)
    expect(remaining[0].name).toBe('B')
  })

  it('is a no-op for unknown bookmark id', () => {
    saveBookmark(TRACK_ID, { name: 'X', startMs: 0, endMs: 1000 })
    deleteBookmark(TRACK_ID, 'non-existent-id')
    expect(getBookmarks(TRACK_ID)).toHaveLength(1)
  })
})

describe('updateBookmark', () => {
  it('updates name, startMs, endMs in place', () => {
    const bm = saveBookmark(TRACK_ID, { name: 'Old', startMs: 0, endMs: 5000 })
    updateBookmark(TRACK_ID, bm.id, { name: 'New', startMs: 1000, endMs: 6000 })
    const result = getBookmarks(TRACK_ID)[0]
    expect(result.name).toBe('New')
    expect(result.startMs).toBe(1000)
    expect(result.endMs).toBe(6000)
  })

  it('does NOT change the bookmark id', () => {
    const bm = saveBookmark(TRACK_ID, { name: 'X', startMs: 0, endMs: 1000 })
    const updated = updateBookmark(TRACK_ID, bm.id, { name: 'Y', startMs: 500, endMs: 1500 })
    expect(updated.id).toBe(bm.id)
  })

  it('does NOT affect other bookmarks in the same track', () => {
    const a = saveBookmark(TRACK_ID, { name: 'A', startMs: 0, endMs: 5000 })
    saveBookmark(TRACK_ID, { name: 'B', startMs: 5000, endMs: 10_000 })
    updateBookmark(TRACK_ID, a.id, { name: 'A updated', startMs: 100, endMs: 4900 })
    const bms = getBookmarks(TRACK_ID)
    expect(bms).toHaveLength(2)
    expect(bms.find((b) => b.name === 'B')).toBeDefined()
  })

  it('leaves other tracks untouched', () => {
    const bm = saveBookmark(TRACK_ID, { name: 'Mine', startMs: 0, endMs: 5000 })
    saveBookmark('other-track', { name: 'Other', startMs: 0, endMs: 5000 })
    updateBookmark(TRACK_ID, bm.id, { name: 'Updated', startMs: 100, endMs: 4900 })
    const other = getBookmarks('other-track')
    expect(other).toHaveLength(1)
    expect(other[0].name).toBe('Other')
  })

  it('throws for unknown bookmark id', () => {
    saveBookmark(TRACK_ID, { name: 'Z', startMs: 0, endMs: 1000 })
    expect(() =>
      updateBookmark(TRACK_ID, 'non-existent-id', { name: 'Nope', startMs: 0, endMs: 1000 }),
    ).toThrow('Bookmark not found: non-existent-id')
    expect(getBookmarks(TRACK_ID)).toHaveLength(1)
  })
})
