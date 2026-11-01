import { writable, derived, type Readable } from 'svelte/store'
import type { Bookmark, BookmarkDraft } from '$lib/models/bookmark'
import type { IBookmarkStorageService } from '$lib/services/BookmarkStorageService'

export interface BookmarkViewModel {
  sortedBookmarks: Readable<Bookmark[]>

  showBookmarksForTrack(trackId: string | null): void
  addBookmark(draft: BookmarkDraft): void
  editBookmark(bookmarkId: string, draft: BookmarkDraft): void
  deleteBookmark(bookmarkId: string): void
}

export function createBookmarkViewModel(
  bookmarkStorage: IBookmarkStorageService,
): BookmarkViewModel {
  const bookmarksStore = writable<Bookmark[]>([])
  let currentTrackId: string | null = null

  return {
    sortedBookmarks: derived(bookmarksStore, (bookmarks) =>
      [...bookmarks].sort((a, b) => a.startMs - b.startMs),
    ),

    showBookmarksForTrack(trackId) {
      if (trackId === currentTrackId) return
      currentTrackId = trackId
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
    },
  }
}
