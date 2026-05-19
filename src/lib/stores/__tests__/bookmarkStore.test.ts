import { describe, it, expect, beforeEach } from 'vitest'
import { get } from 'svelte/store'
import { bookmarkStore } from '../bookmarkStore'
import { getBookmarks } from '$lib/bookmarks/store'

const TRACK_ID = 'test-track-001'

beforeEach(() => {
  localStorage.clear()
  bookmarkStore.setTrackId(null)
})

describe('bookmarkStore – add', () => {
  it('adds a bookmark to the store', () => {
    bookmarkStore.setTrackId(TRACK_ID)
    bookmarkStore.add('Vers 1', 0, 5000)
    expect(get(bookmarkStore)).toHaveLength(1)
    expect(get(bookmarkStore)[0].name).toBe('Vers 1')
  })

  it('persists the bookmark to localStorage', () => {
    bookmarkStore.setTrackId(TRACK_ID)
    bookmarkStore.add('Bro', 10_000, 20_000)
    expect(getBookmarks(TRACK_ID)).toHaveLength(1)
    expect(getBookmarks(TRACK_ID)[0].name).toBe('Bro')
  })

  it('does nothing if no track is active', () => {
    bookmarkStore.setTrackId(null)
    bookmarkStore.add('Ghost', 0, 1000)
    expect(get(bookmarkStore)).toHaveLength(0)
  })
})

describe('bookmarkStore – remove', () => {
  it('removes the bookmark from the store', () => {
    bookmarkStore.setTrackId(TRACK_ID)
    bookmarkStore.add('Solo', 5000, 15_000)
    const bm = get(bookmarkStore)[0]
    bookmarkStore.remove(bm.id)
    expect(get(bookmarkStore)).toHaveLength(0)
  })

  it('removes from localStorage', () => {
    bookmarkStore.setTrackId(TRACK_ID)
    bookmarkStore.add('Solo', 5000, 15_000)
    const bm = get(bookmarkStore)[0]
    bookmarkStore.remove(bm.id)
    expect(getBookmarks(TRACK_ID)).toHaveLength(0)
  })

  it('leaves other bookmarks intact', () => {
    bookmarkStore.setTrackId(TRACK_ID)
    bookmarkStore.add('A', 0, 5000)
    bookmarkStore.add('B', 5000, 10_000)
    const bmA = get(bookmarkStore).find((b) => b.name === 'A')!
    bookmarkStore.remove(bmA.id)
    expect(get(bookmarkStore)).toHaveLength(1)
    expect(get(bookmarkStore)[0].name).toBe('B')
  })
})

describe('bookmarkStore – edit', () => {
  it('updates name, startMs, endMs in the store', () => {
    bookmarkStore.setTrackId(TRACK_ID)
    bookmarkStore.add('Old name', 0, 5000)
    const bm = get(bookmarkStore)[0]
    bookmarkStore.edit(bm.id, 'New name', 1000, 6000)
    const updated = get(bookmarkStore)[0]
    expect(updated.name).toBe('New name')
    expect(updated.startMs).toBe(1000)
    expect(updated.endMs).toBe(6000)
  })

  it('persists the change to localStorage', () => {
    bookmarkStore.setTrackId(TRACK_ID)
    bookmarkStore.add('X', 0, 3000)
    const bm = get(bookmarkStore)[0]
    bookmarkStore.edit(bm.id, 'X edited', 500, 2500)
    const stored = getBookmarks(TRACK_ID)[0]
    expect(stored.name).toBe('X edited')
  })

  it('does not affect other bookmarks', () => {
    bookmarkStore.setTrackId(TRACK_ID)
    bookmarkStore.add('First', 0, 5000)
    bookmarkStore.add('Second', 5000, 10_000)
    const first = get(bookmarkStore).find((b) => b.name === 'First')!
    bookmarkStore.edit(first.id, 'First edited', 100, 4900)
    const second = get(bookmarkStore).find((b) => b.name === 'Second')
    expect(second).toBeDefined()
    expect(second!.name).toBe('Second')
  })
})
