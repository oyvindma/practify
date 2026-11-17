import { writable, derived, get, type Readable } from 'svelte/store'
import type { Bookmark, BookmarkDraft } from '$lib/models/bookmark'
import type { IBookmarkStorageService } from '$lib/services/BookmarkStorageService'

export interface BookmarkViewModel {
  sortedBookmarks: Readable<Bookmark[]>
  // The loop picked with the keyboard (or last started); not necessarily the playing one
  selectedBookmarkId: Readable<string | null>

  showBookmarksForTrack(trackId: string | null): void
  addBookmark(draft: BookmarkDraft): void
  editBookmark(bookmarkId: string, draft: BookmarkDraft): void
  deleteBookmark(bookmarkId: string): void
  selectBookmark(bookmarkId: string | null): void
  selectNextBookmark(): void
  selectPreviousBookmark(): void
}

export function createBookmarkViewModel(
  bookmarkStorage: IBookmarkStorageService,
): BookmarkViewModel {
  const bookmarksStore = writable<Bookmark[]>([])
  const selectedIdStore = writable<string | null>(null)
  let currentTrackId: string | null = null

  const sorted = () => [...get(bookmarksStore)].sort((a, b) => a.startMs - b.startMs)

  function moveSelection(step: 1 | -1) {
    const bookmarks = sorted()
    if (bookmarks.length === 0) return
    const currentIndex = bookmarks.findIndex((b) => b.id === get(selectedIdStore))
    const fallbackIndex = step === 1 ? 0 : bookmarks.length - 1
    const nextIndex = currentIndex === -1 ? fallbackIndex : currentIndex + step
    const clampedIndex = Math.min(bookmarks.length - 1, Math.max(0, nextIndex))
    selectedIdStore.set(bookmarks[clampedIndex].id)
  }

  return {
    sortedBookmarks: derived(bookmarksStore, (bookmarks) =>
      [...bookmarks].sort((a, b) => a.startMs - b.startMs),
    ),

    selectedBookmarkId: { subscribe: selectedIdStore.subscribe },

    showBookmarksForTrack(trackId) {
      if (trackId === currentTrackId) return
      currentTrackId = trackId
      selectedIdStore.set(null)
      bookmarksStore.set(trackId ? bookmarkStorage.getBookmarks(trackId) : [])
    },

    addBookmark(draft) {
      if (!currentTrackId) return
      const saved = bookmarkStorage.saveBookmark(currentTrackId, draft)
      bookmarksStore.update((bookmarks) => [...bookmarks, saved])
    },

    editBookmark(bookmarkId, draft) {
      if (!currentTrackId) return
      const updated = bookmarkStorage.updateBookmark(currentTrackId, bookmarkId, draft)
      bookmarksStore.update((bookmarks) =>
        bookmarks.map((b) => (b.id === bookmarkId ? updated : b)),
      )
    },

    deleteBookmark(bookmarkId) {
      if (!currentTrackId) return
      bookmarkStorage.deleteBookmark(currentTrackId, bookmarkId)
      bookmarksStore.update((bookmarks) => bookmarks.filter((b) => b.id !== bookmarkId))
      if (get(selectedIdStore) === bookmarkId) selectedIdStore.set(null)
    },

    selectBookmark(bookmarkId) {
      selectedIdStore.set(bookmarkId)
    },

    selectNextBookmark: () => moveSelection(1),
    selectPreviousBookmark: () => moveSelection(-1),
  }
}
