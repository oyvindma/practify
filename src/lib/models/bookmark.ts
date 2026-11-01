export interface Bookmark {
  id: string
  trackId: string
  name: string
  startMs: number
  endMs: number
}

export interface BookmarkDraft {
  name: string
  startMs: number
  endMs: number
}
