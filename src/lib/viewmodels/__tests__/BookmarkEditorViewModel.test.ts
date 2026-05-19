import { describe, it, expect, beforeEach } from 'vitest'
import { get } from 'svelte/store'
import {
  createBookmarkEditorViewModel,
  type BookmarkEditorViewModel,
} from '../BookmarkEditorViewModel'
import type { IBookmarkStorageService } from '$lib/services/BookmarkStorageService'
import type { Bookmark } from '$lib/bookmarks/types'

function createInMemoryBookmarkStorage(): IBookmarkStorageService {
  let idCounter = 0
  const bookmarksByTrack = new Map<string, Bookmark[]>()

  return {
    getBookmarks(trackId: string): Bookmark[] {
      return bookmarksByTrack.get(trackId) ?? []
    },
    saveBookmark(trackId: string, input: Omit<Bookmark, 'id' | 'trackId'>): Bookmark {
      const bookmark: Bookmark = { id: `bm-${++idCounter}`, trackId, ...input }
      const existing = bookmarksByTrack.get(trackId) ?? []
      bookmarksByTrack.set(trackId, [...existing, bookmark])
      return bookmark
    },
    deleteBookmark(trackId: string, bookmarkId: string): void {
      const existing = bookmarksByTrack.get(trackId) ?? []
      bookmarksByTrack.set(
        trackId,
        existing.filter((b) => b.id !== bookmarkId),
      )
    },
  }
}

const TRACK_ID = 'track-123'

describe('BookmarkEditorViewModel', () => {
  let viewModel: BookmarkEditorViewModel
  let storage: IBookmarkStorageService

  beforeEach(() => {
    storage = createInMemoryBookmarkStorage()
    viewModel = createBookmarkEditorViewModel(storage)
  })

  describe('initial state', () => {
    it('starts with empty editor fields', () => {
      const state = get(viewModel.editorState)
      expect(state.name).toBe('')
      expect(state.startMs).toBe(0)
      expect(state.endMs).toBe(0)
      expect(state.validationError).toBeNull()
    })

    it('starts with empty bookmarks', () => {
      expect(get(viewModel.sortedBookmarks)).toEqual([])
    })
  })

  describe('updateName / captureStartPosition / captureEndPosition', () => {
    it('updates editor name', () => {
      viewModel.updateName('Vers 1')
      expect(get(viewModel.editorState).name).toBe('Vers 1')
    })

    it('updates start time', () => {
      viewModel.captureStartPosition(15_000)
      expect(get(viewModel.editorState).startMs).toBe(15_000)
    })

    it('updates end time', () => {
      viewModel.captureEndPosition(45_000)
      expect(get(viewModel.editorState).endMs).toBe(45_000)
    })

    it('clears validation error when a field is updated', () => {
      viewModel.saveBookmark(TRACK_ID)
      expect(get(viewModel.editorState).validationError).not.toBeNull()

      viewModel.updateName('Fixed')
      expect(get(viewModel.editorState).validationError).toBeNull()
    })
  })

  describe('saveBookmark', () => {
    it('rejects empty name', () => {
      viewModel.captureStartPosition(0)
      viewModel.captureEndPosition(10_000)
      const succeeded = viewModel.saveBookmark(TRACK_ID)
      expect(succeeded).toBe(false)
      expect(get(viewModel.editorState).validationError).toBe('Gi partiet et navn')
    })

    it('rejects whitespace-only name', () => {
      viewModel.updateName('   ')
      viewModel.captureEndPosition(10_000)
      const succeeded = viewModel.saveBookmark(TRACK_ID)
      expect(succeeded).toBe(false)
      expect(get(viewModel.editorState).validationError).toBe('Gi partiet et navn')
    })

    it('rejects end <= start', () => {
      viewModel.updateName('Test')
      viewModel.captureStartPosition(5_000)
      viewModel.captureEndPosition(5_000)
      const succeeded = viewModel.saveBookmark(TRACK_ID)
      expect(succeeded).toBe(false)
      expect(get(viewModel.editorState).validationError).toBe(
        'Slutttidspunkt må være etter starttidspunkt',
      )
    })

    it('saves valid bookmark and resets editor', () => {
      viewModel.updateName('Solo')
      viewModel.captureStartPosition(30_000)
      viewModel.captureEndPosition(60_000)
      const succeeded = viewModel.saveBookmark(TRACK_ID)
      expect(succeeded).toBe(true)

      const state = get(viewModel.editorState)
      expect(state.name).toBe('')
      expect(state.startMs).toBe(0)
      expect(state.endMs).toBe(0)
      expect(state.validationError).toBeNull()

      const bookmarks = get(viewModel.sortedBookmarks)
      expect(bookmarks).toHaveLength(1)
      expect(bookmarks[0].name).toBe('Solo')
      expect(bookmarks[0].startMs).toBe(30_000)
    })

    it('trims bookmark name', () => {
      viewModel.updateName('  Bro  ')
      viewModel.captureStartPosition(10_000)
      viewModel.captureEndPosition(20_000)
      viewModel.saveBookmark(TRACK_ID)
      expect(get(viewModel.sortedBookmarks)[0].name).toBe('Bro')
    })

    it('persists to storage service', () => {
      viewModel.updateName('Riff')
      viewModel.captureStartPosition(0)
      viewModel.captureEndPosition(5_000)
      viewModel.saveBookmark(TRACK_ID)
      expect(storage.getBookmarks(TRACK_ID)).toHaveLength(1)
    })
  })

  describe('deleteBookmark', () => {
    it('removes a bookmark by id', () => {
      viewModel.updateName('A')
      viewModel.captureStartPosition(0)
      viewModel.captureEndPosition(5_000)
      viewModel.saveBookmark(TRACK_ID)

      const bookmarkId = get(viewModel.sortedBookmarks)[0].id
      viewModel.deleteBookmark(TRACK_ID, bookmarkId)

      expect(get(viewModel.sortedBookmarks)).toHaveLength(0)
      expect(storage.getBookmarks(TRACK_ID)).toHaveLength(0)
    })

    it('leaves other bookmarks untouched', () => {
      viewModel.updateName('A')
      viewModel.captureStartPosition(0)
      viewModel.captureEndPosition(5_000)
      viewModel.saveBookmark(TRACK_ID)

      viewModel.updateName('B')
      viewModel.captureStartPosition(5_000)
      viewModel.captureEndPosition(10_000)
      viewModel.saveBookmark(TRACK_ID)

      const firstBookmarkId = get(viewModel.sortedBookmarks)[0].id
      viewModel.deleteBookmark(TRACK_ID, firstBookmarkId)

      const remaining = get(viewModel.sortedBookmarks)
      expect(remaining).toHaveLength(1)
      expect(remaining[0].name).toBe('B')
    })
  })

  describe('loadBookmarksForTrack', () => {
    it('loads bookmarks from storage for a track', () => {
      storage.saveBookmark(TRACK_ID, { name: 'Pre', startMs: 0, endMs: 5_000 })

      viewModel.loadBookmarksForTrack(TRACK_ID)
      expect(get(viewModel.sortedBookmarks)).toHaveLength(1)
      expect(get(viewModel.sortedBookmarks)[0].name).toBe('Pre')
    })

    it('replaces previous bookmarks on track change', () => {
      viewModel.updateName('A')
      viewModel.captureStartPosition(0)
      viewModel.captureEndPosition(5_000)
      viewModel.saveBookmark(TRACK_ID)

      viewModel.loadBookmarksForTrack('other-track')
      expect(get(viewModel.sortedBookmarks)).toHaveLength(0)
    })
  })

  describe('sortedBookmarks', () => {
    it('returns bookmarks sorted by startMs', () => {
      viewModel.updateName('Late')
      viewModel.captureStartPosition(60_000)
      viewModel.captureEndPosition(90_000)
      viewModel.saveBookmark(TRACK_ID)

      viewModel.updateName('Early')
      viewModel.captureStartPosition(10_000)
      viewModel.captureEndPosition(30_000)
      viewModel.saveBookmark(TRACK_ID)

      const bookmarks = get(viewModel.sortedBookmarks)
      expect(bookmarks[0].name).toBe('Early')
      expect(bookmarks[1].name).toBe('Late')
    })
  })
})
