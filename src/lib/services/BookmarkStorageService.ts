import { v4 as generateUuid } from 'uuid'
import type { Bookmark, BookmarkDraft } from '$lib/models/bookmark'

export interface IBookmarkStorageService {
  getBookmarks(trackId: string): Bookmark[]
  saveBookmark(trackId: string, draft: BookmarkDraft): Bookmark
  updateBookmark(trackId: string, bookmarkId: string, draft: BookmarkDraft): Bookmark
  deleteBookmark(trackId: string, bookmarkId: string): void
}

function buildStorageKey(trackId: string): string {
  return `bookmarks_${trackId}`
}

export class BookmarkStorageService implements IBookmarkStorageService {
  getBookmarks(trackId: string): Bookmark[] {
    const rawJson = localStorage.getItem(buildStorageKey(trackId))
    if (!rawJson) return []
    try {
      return JSON.parse(rawJson) as Bookmark[]
    } catch {
      return []
    }
  }

  saveBookmark(trackId: string, draft: BookmarkDraft): Bookmark {
    const bookmark: Bookmark = { id: generateUuid(), trackId, ...draft }
    this.writeBookmarks(trackId, [...this.getBookmarks(trackId), bookmark])
    return bookmark
  }

  updateBookmark(trackId: string, bookmarkId: string, draft: BookmarkDraft): Bookmark {
    const bookmarks = this.getBookmarks(trackId)
    const existing = bookmarks.find((b) => b.id === bookmarkId)
    if (!existing) throw new Error(`Bookmark not found: ${bookmarkId}`)

    const updated: Bookmark = { ...existing, ...draft }
    this.writeBookmarks(
      trackId,
      bookmarks.map((b) => (b.id === bookmarkId ? updated : b)),
    )
    return updated
  }

  deleteBookmark(trackId: string, bookmarkId: string): void {
    this.writeBookmarks(
      trackId,
      this.getBookmarks(trackId).filter((b) => b.id !== bookmarkId),
    )
  }

  private writeBookmarks(trackId: string, bookmarks: Bookmark[]): void {
    localStorage.setItem(buildStorageKey(trackId), JSON.stringify(bookmarks))
  }
}
