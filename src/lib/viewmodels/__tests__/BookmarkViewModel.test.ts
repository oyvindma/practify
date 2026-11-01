import { describe, it, expect, beforeEach } from 'vitest'
import { get } from 'svelte/store'
import { BookmarkStorageService } from '$lib/services/BookmarkStorageService'
import { createBookmarkViewModel, type BookmarkViewModel } from '../BookmarkViewModel'

const storage = new BookmarkStorageService()
let viewModel: BookmarkViewModel

const TRACK_ID = 'test-track-001'

beforeEach(() => {
  localStorage.clear()
  viewModel = createBookmarkViewModel(storage)
})

const bookmarks = () => get(viewModel.sortedBookmarks)

describe('BookmarkViewModel – add', () => {
  it('adds a bookmark to the store', () => {
    viewModel.showBookmarksForTrack(TRACK_ID)
    viewModel.addBookmark({ name: 'Vers 1', startMs: 0, endMs: 5000 })
    expect(bookmarks()).toHaveLength(1)
    expect(bookmarks()[0].name).toBe('Vers 1')
  })

  it('persists the bookmark to localStorage', () => {
    viewModel.showBookmarksForTrack(TRACK_ID)
    viewModel.addBookmark({ name: 'Bro', startMs: 10_000, endMs: 20_000 })
    expect(storage.getBookmarks(TRACK_ID)).toHaveLength(1)
    expect(storage.getBookmarks(TRACK_ID)[0].name).toBe('Bro')
  })

  it('does nothing if no track is active', () => {
    viewModel.showBookmarksForTrack(null)
    viewModel.addBookmark({ name: 'Ghost', startMs: 0, endMs: 1000 })
    expect(bookmarks()).toHaveLength(0)
  })
})

describe('BookmarkViewModel – remove', () => {
  it('removes the bookmark from the store', () => {
    viewModel.showBookmarksForTrack(TRACK_ID)
    viewModel.addBookmark({ name: 'Solo', startMs: 5000, endMs: 15_000 })
    const bm = bookmarks()[0]
    viewModel.deleteBookmark(bm.id)
    expect(bookmarks()).toHaveLength(0)
  })

  it('removes from localStorage', () => {
    viewModel.showBookmarksForTrack(TRACK_ID)
    viewModel.addBookmark({ name: 'Solo', startMs: 5000, endMs: 15_000 })
    const bm = bookmarks()[0]
    viewModel.deleteBookmark(bm.id)
    expect(storage.getBookmarks(TRACK_ID)).toHaveLength(0)
  })

  it('leaves other bookmarks intact', () => {
    viewModel.showBookmarksForTrack(TRACK_ID)
    viewModel.addBookmark({ name: 'A', startMs: 0, endMs: 5000 })
    viewModel.addBookmark({ name: 'B', startMs: 5000, endMs: 10_000 })
    const bmA = bookmarks().find((b) => b.name === 'A')!
    viewModel.deleteBookmark(bmA.id)
    expect(bookmarks()).toHaveLength(1)
    expect(bookmarks()[0].name).toBe('B')
  })
})

describe('BookmarkViewModel – edit', () => {
  it('updates name, startMs, endMs in the store', () => {
    viewModel.showBookmarksForTrack(TRACK_ID)
    viewModel.addBookmark({ name: 'Old name', startMs: 0, endMs: 5000 })
    const bm = bookmarks()[0]
    viewModel.editBookmark(bm.id, { name: 'New name', startMs: 1000, endMs: 6000 })
    const updated = bookmarks()[0]
    expect(updated.name).toBe('New name')
    expect(updated.startMs).toBe(1000)
    expect(updated.endMs).toBe(6000)
  })

  it('persists the change to localStorage', () => {
    viewModel.showBookmarksForTrack(TRACK_ID)
    viewModel.addBookmark({ name: 'X', startMs: 0, endMs: 3000 })
    const bm = bookmarks()[0]
    viewModel.editBookmark(bm.id, { name: 'X edited', startMs: 500, endMs: 2500 })
    const stored = storage.getBookmarks(TRACK_ID)[0]
    expect(stored.name).toBe('X edited')
  })

  it('does not affect other bookmarks', () => {
    viewModel.showBookmarksForTrack(TRACK_ID)
    viewModel.addBookmark({ name: 'First', startMs: 0, endMs: 5000 })
    viewModel.addBookmark({ name: 'Second', startMs: 5000, endMs: 10_000 })
    const first = bookmarks().find((b) => b.name === 'First')!
    viewModel.editBookmark(first.id, { name: 'First edited', startMs: 100, endMs: 4900 })
    const second = bookmarks().find((b) => b.name === 'Second')
    expect(second).toBeDefined()
    expect(second!.name).toBe('Second')
  })
})

describe('BookmarkViewModel – sorting and track scoping', () => {
  it('sorts bookmarks by start time', () => {
    viewModel.showBookmarksForTrack(TRACK_ID)
    viewModel.addBookmark({ name: 'Late', startMs: 9000, endMs: 10_000 })
    viewModel.addBookmark({ name: 'Early', startMs: 1000, endMs: 2000 })
    expect(bookmarks().map((b) => b.name)).toEqual(['Early', 'Late'])
  })

  it('loads the bookmarks of the newly shown track', () => {
    storage.saveBookmark('other-track', { name: 'Other', startMs: 0, endMs: 1000 })
    viewModel.showBookmarksForTrack(TRACK_ID)
    expect(bookmarks()).toHaveLength(0)
    viewModel.showBookmarksForTrack('other-track')
    expect(bookmarks().map((b) => b.name)).toEqual(['Other'])
  })

  it('clears bookmarks when no track is shown', () => {
    viewModel.showBookmarksForTrack(TRACK_ID)
    viewModel.addBookmark({ name: 'A', startMs: 0, endMs: 1000 })
    viewModel.showBookmarksForTrack(null)
    expect(bookmarks()).toHaveLength(0)
  })
})
