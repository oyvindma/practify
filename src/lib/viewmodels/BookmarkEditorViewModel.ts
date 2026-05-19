import { writable, derived, get, type Readable } from 'svelte/store'
import type { Bookmark } from '$lib/bookmarks/types'
import {
  BookmarkStorageService,
  type IBookmarkStorageService,
} from '$lib/services/BookmarkStorageService'

export interface BookmarkEditorState {
  name: string
  startMs: number
  endMs: number
  validationError: string | null
}

export interface BookmarkEditorViewModel {
  editorState: Readable<BookmarkEditorState>
  sortedBookmarks: Readable<Bookmark[]>

  updateName(name: string): void
  captureStartPosition(positionMs: number): void
  captureEndPosition(positionMs: number): void
  saveBookmark(trackId: string): boolean
  deleteBookmark(trackId: string, bookmarkId: string): void
  loadBookmarksForTrack(trackId: string): void
}

const EMPTY_EDITOR_STATE: BookmarkEditorState = {
  name: '',
  startMs: 0,
  endMs: 0,
  validationError: null,
}

export function createBookmarkEditorViewModel(
  bookmarkStorage: IBookmarkStorageService = new BookmarkStorageService(),
): BookmarkEditorViewModel {
  const editorStore = writable<BookmarkEditorState>({ ...EMPTY_EDITOR_STATE })
  const bookmarkListStore = writable<Bookmark[]>([])

  const bookmarksSortedByStart = derived(bookmarkListStore, (bookmarks) =>
    [...bookmarks].sort((a, b) => a.startMs - b.startMs),
  )

  function clearValidationError(state: BookmarkEditorState): BookmarkEditorState {
    return { ...state, validationError: null }
  }

  return {
    editorState: { subscribe: editorStore.subscribe },
    sortedBookmarks: bookmarksSortedByStart,

    updateName(name: string) {
      editorStore.update((state) => clearValidationError({ ...state, name }))
    },

    captureStartPosition(positionMs: number) {
      editorStore.update((state) => clearValidationError({ ...state, startMs: positionMs }))
    },

    captureEndPosition(positionMs: number) {
      editorStore.update((state) => clearValidationError({ ...state, endMs: positionMs }))
    },

    saveBookmark(trackId: string): boolean {
      const { name, startMs, endMs } = get(editorStore)

      if (!name.trim()) {
        editorStore.update((state) => ({ ...state, validationError: 'Gi partiet et navn' }))
        return false
      }
      if (endMs <= startMs) {
        editorStore.update((state) => ({
          ...state,
          validationError: 'Slutttidspunkt må være etter starttidspunkt',
        }))
        return false
      }

      const savedBookmark = bookmarkStorage.saveBookmark(trackId, {
        name: name.trim(),
        startMs,
        endMs,
      })
      bookmarkListStore.update((bookmarks) => [...bookmarks, savedBookmark])
      editorStore.set({ ...EMPTY_EDITOR_STATE })
      return true
    },

    deleteBookmark(trackId: string, bookmarkId: string) {
      bookmarkStorage.deleteBookmark(trackId, bookmarkId)
      bookmarkListStore.update((bookmarks) => bookmarks.filter((b) => b.id !== bookmarkId))
    },

    loadBookmarksForTrack(trackId: string) {
      bookmarkListStore.set(bookmarkStorage.getBookmarks(trackId))
    },
  }
}
