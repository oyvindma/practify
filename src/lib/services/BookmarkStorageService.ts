import { v4 as generateUuid } from 'uuid'
import type { Bookmark } from '$lib/bookmarks/types'

export interface IBookmarkStorageService {
  getBookmarks(trackId: string): Bookmark[]
  saveBookmark(trackId: string, data: Omit<Bookmark, 'id' | 'trackId'>): Bookmark
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

  saveBookmark(trackId: string, data: Omit<Bookmark, 'id' | 'trackId'>): Bookmark {
    const bookmark: Bookmark = { id: generateUuid(), trackId, ...data }
    const existingBookmarks = this.getBookmarks(trackId)
    localStorage.setItem(
      buildStorageKey(trackId),
      JSON.stringify([...existingBookmarks, bookmark]),
    )
    return bookmark
  }

  deleteBookmark(trackId: string, bookmarkId: string): void {
    const remainingBookmarks = this.getBookmarks(trackId).filter((b) => b.id !== bookmarkId)
    localStorage.setItem(buildStorageKey(trackId), JSON.stringify(remainingBookmarks))
  }
}
