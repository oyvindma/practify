import { writable, get, type Readable } from 'svelte/store'
import type { Bookmark } from '$lib/models/bookmark'
import type { PlayerState } from '$lib/models/player'
import { adjustMs, formatMs, parseMs } from '$lib/models/time'
import type { BookmarkViewModel } from './BookmarkViewModel'
import type { PlayerViewModel } from './PlayerViewModel'

const PREVIEW_DELAY_MS = 500
const WHEEL_STEP_MS = 100
const END_PREVIEW_LEAD_IN_MS = 2000

export interface BookmarkEditorState {
  name: string
  startMs: number
  endMs: number
  startInput: string
  endInput: string
  validationError: string | null
  isDirty: boolean
  editingBookmark: Bookmark | null
}

export interface BookmarkEditorViewModel {
  editorState: Readable<BookmarkEditorState>

  updateName(name: string): void
  updateStartInput(text: string): void
  updateEndInput(text: string): void
  commitStartInput(): void
  commitEndInput(): void
  captureStartPosition(): Promise<void>
  captureEndPosition(): Promise<void>
  nudgeStart(direction: 1 | -1): void
  nudgeEnd(direction: 1 | -1): void
  beginEditing(bookmark: Bookmark): void
  cancel(): void
  submit(): boolean
}

type PlayerForEditor = Pick<
  PlayerViewModel,
  'playerState' | 'activateLoop' | 'deactivatePreviewLoop' | 'getCurrentPositionMs'
>
type BookmarksForEditor = Pick<
  BookmarkViewModel,
  'addBookmark' | 'editBookmark' | 'sortedBookmarks'
>

function emptyState(): BookmarkEditorState {
  return {
    name: '',
    startMs: 0,
    endMs: 0,
    startInput: formatMs(0),
    endInput: formatMs(0),
    validationError: null,
    isDirty: false,
    editingBookmark: null,
  }
}

export function createBookmarkEditorViewModel(
  bookmarks: BookmarksForEditor,
  player: PlayerForEditor,
): BookmarkEditorViewModel {
  const stateStore = writable<BookmarkEditorState>(emptyState())
  let previewTimer: ReturnType<typeof setTimeout> | null = null

  const currentPlayerState = (): PlayerState => get(player.playerState)
  const currentTrackId = (): string | null => currentPlayerState().track?.id ?? null

  function cancelPreview() {
    if (previewTimer === null) return
    clearTimeout(previewTimer)
    previewTimer = null
  }

  function schedulePreview(options?: { startFrom: number }) {
    cancelPreview()
    const { startMs, endMs } = get(stateStore)
    if (startMs >= endMs) return
    previewTimer = setTimeout(() => {
      player.activateLoop({ startMs, endMs }, options)
    }, PREVIEW_DELAY_MS)
  }

  function previewFromEndLeadIn() {
    schedulePreview({ startFrom: Math.max(0, get(stateStore).endMs - END_PREVIEW_LEAD_IN_MS) })
  }

  function setStart(startMs: number) {
    stateStore.update((s) => {
      const endMs = s.endMs === 0 ? currentPlayerState().durationMs : s.endMs
      return {
        ...s,
        startMs,
        startInput: formatMs(startMs),
        endMs,
        endInput: formatMs(endMs),
        isDirty: true,
      }
    })
    schedulePreview()
  }

  function setEnd(endMs: number) {
    stateStore.update((s) => ({ ...s, endMs, endInput: formatMs(endMs), isDirty: true }))
    previewFromEndLeadIn()
  }

  function fail(validationError: string): false {
    stateStore.update((s) => ({ ...s, validationError }))
    return false
  }

  function reset() {
    cancelPreview()
    player.deactivatePreviewLoop()
    stateStore.set(emptyState())
  }

  let lastTrackId = currentTrackId()
  player.playerState.subscribe(() => {
    const trackId = currentTrackId()
    if (trackId === lastTrackId) return
    lastTrackId = trackId
    reset()
  })

  bookmarks.sortedBookmarks.subscribe((list) => {
    const { editingBookmark } = get(stateStore)
    if (editingBookmark && !list.some((b) => b.id === editingBookmark.id)) reset()
  })

  return {
    editorState: { subscribe: stateStore.subscribe },

    updateName(name) {
      stateStore.update((s) => ({ ...s, name, isDirty: true, validationError: null }))
    },

    updateStartInput(text) {
      stateStore.update((s) => ({ ...s, startInput: text }))
    },

    updateEndInput(text) {
      stateStore.update((s) => ({ ...s, endInput: text }))
    },

    commitStartInput() {
      const { startInput, startMs } = get(stateStore)
      setStart(parseMs(startInput) ?? startMs)
    },

    commitEndInput() {
      const { endInput, endMs } = get(stateStore)
      setEnd(parseMs(endInput) ?? endMs)
    },

    async captureStartPosition() {
      setStart(await player.getCurrentPositionMs())
    },

    async captureEndPosition() {
      setEnd(await player.getCurrentPositionMs())
    },

    nudgeStart(direction) {
      setStart(adjustMs(get(stateStore).startMs, direction * WHEEL_STEP_MS))
    },

    nudgeEnd(direction) {
      setEnd(adjustMs(get(stateStore).endMs, direction * WHEEL_STEP_MS))
    },

    beginEditing(bookmark) {
      cancelPreview()
      player.deactivatePreviewLoop()
      stateStore.set({
        ...emptyState(),
        name: bookmark.name,
        startMs: bookmark.startMs,
        endMs: bookmark.endMs,
        startInput: formatMs(bookmark.startMs),
        endInput: formatMs(bookmark.endMs),
        editingBookmark: bookmark,
      })
    },

    cancel: reset,

    submit() {
      const { name, startMs, endMs, editingBookmark } = get(stateStore)
      const trimmedName = name.trim()

      if (!trimmedName) return fail('Gi partiet et navn')
      if (endMs <= startMs) return fail('Slutttidspunkt må være etter starttidspunkt')

      const draft = { name: trimmedName, startMs, endMs }
      if (editingBookmark) bookmarks.editBookmark(editingBookmark.id, draft)
      else bookmarks.addBookmark(draft)
      reset()
      return true
    },
  }
}
