import { v4 as uuidv4 } from 'uuid'
import type { Bookmark } from './types'

const storageKey = (trackId: string) => `bookmarks_${trackId}`

export function getBookmarks(trackId: string): Bookmark[] {
  const raw = localStorage.getItem(storageKey(trackId))
  if (!raw) return []
  try {
    return JSON.parse(raw) as Bookmark[]
  } catch {
    return []
  }
}

export function saveBookmark(
  trackId: string,
  data: Omit<Bookmark, 'id' | 'trackId'>,
): Bookmark {
  const bookmark: Bookmark = { id: uuidv4(), trackId, ...data }
  const existing = getBookmarks(trackId)
  localStorage.setItem(storageKey(trackId), JSON.stringify([...existing, bookmark]))
  return bookmark
}

export function deleteBookmark(trackId: string, bookmarkId: string): void {
  const updated = getBookmarks(trackId).filter((b) => b.id !== bookmarkId)
  localStorage.setItem(storageKey(trackId), JSON.stringify(updated))
}

export function updateBookmark(
  trackId: string,
  bookmarkId: string,
  data: Omit<Bookmark, 'id' | 'trackId'>,
): Bookmark {
  const bookmarks = getBookmarks(trackId)
  const updated = bookmarks.map((b) => (b.id === bookmarkId ? { ...b, ...data } : b))
  localStorage.setItem(storageKey(trackId), JSON.stringify(updated))
  const result = updated.find((b) => b.id === bookmarkId)
  if (!result) throw new Error(`Bookmark not found: ${bookmarkId}`)
  return result
}
