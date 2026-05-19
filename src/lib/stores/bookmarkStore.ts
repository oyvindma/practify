import { writable, derived } from 'svelte/store'
import { getBookmarks, saveBookmark, deleteBookmark, updateBookmark } from '$lib/bookmarks/store'
import type { Bookmark } from '$lib/bookmarks/types'

function createBookmarkStore() {
  const { subscribe, set, update } = writable<Bookmark[]>([])

  let currentTrackId: string | null = null

  return {
    subscribe,

    // Called by App to react to track changes (keeps stores independently testable).
    setTrackId(trackId: string | null) {
      if (trackId !== currentTrackId) {
        currentTrackId = trackId
        set(trackId ? getBookmarks(trackId) : [])
      }
    },

    add(name: string, startMs: number, endMs: number) {
      if (!currentTrackId) return
      const bookmark = saveBookmark(currentTrackId, { name, startMs, endMs })
      update((bms) => [...bms, bookmark])
    },

    remove(bookmarkId: string) {
      if (!currentTrackId) return
      deleteBookmark(currentTrackId, bookmarkId)
      update((bms) => bms.filter((b) => b.id !== bookmarkId))
    },

    edit(bookmarkId: string, name: string, startMs: number, endMs: number) {
      if (!currentTrackId) return
      const bookmark = updateBookmark(currentTrackId, bookmarkId, { name, startMs, endMs })
      update((bms) => bms.map((b) => (b.id === bookmarkId ? bookmark : b)))
    },
  }
}

export const bookmarkStore = createBookmarkStore()

export const sortedBookmarks = derived(bookmarkStore, ($bms) =>
  [...$bms].sort((a, b) => a.startMs - b.startMs),
)
