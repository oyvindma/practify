import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest'
import { get, writable } from 'svelte/store'
import { INITIAL_PLAYER_STATE, type PlayerState } from '$lib/models/player'
import type { Bookmark } from '$lib/models/bookmark'
import type { SpotifyTrack } from '$lib/models/spotify'
import {
  createBookmarkEditorViewModel,
  type BookmarkEditorViewModel,
} from '../BookmarkEditorViewModel'

const existingBookmark: Bookmark = {
  id: 'bm-1',
  trackId: 'track-1',
  name: 'Solo',
  startMs: 30_000,
  endMs: 60_000,
}

describe('BookmarkEditorViewModel', () => {
  let viewModel: BookmarkEditorViewModel
  let playerState: ReturnType<typeof writable<PlayerState>>
  let bookmarkList: ReturnType<typeof writable<Bookmark[]>>
  let bookmarks: {
    addBookmark: AnyMock
    editBookmark: AnyMock
    sortedBookmarks: typeof bookmarkList
  }
  let player: {
    playerState: typeof playerState
    activateLoop: AnyMock
    deactivatePreviewLoop: AnyMock
    getCurrentPositionMs: Mock<() => Promise<number>>
  }

  const state = () => get(viewModel.editorState)

  beforeEach(() => {
    vi.useFakeTimers()
    playerState = writable({ ...INITIAL_PLAYER_STATE, positionMs: 12_340, durationMs: 200_000 })
    bookmarkList = writable([])
    bookmarks = { addBookmark: vi.fn(), editBookmark: vi.fn(), sortedBookmarks: bookmarkList }
    player = {
      playerState,
      activateLoop: vi.fn(),
      deactivatePreviewLoop: vi.fn(),
      getCurrentPositionMs: vi.fn(async () => get(playerState).positionMs),
    }
    viewModel = createBookmarkEditorViewModel(bookmarks, player)
  })

  afterEach(() => vi.useRealTimers())

  describe('initial state', () => {
    it('starts empty and clean', async () => {
      expect(state()).toMatchObject({
        name: '',
        startMs: 0,
        endMs: 0,
        startInput: '0:00.00',
        endInput: '0:00.00',
        validationError: null,
        isDirty: false,
        editingBookmark: null,
      })
    })
  })

  describe('capturing positions', () => {
    it('captures the current position as start and fills the end with the track duration', async () => {
      await viewModel.captureStartPosition()
      expect(state().startMs).toBe(12_340)
      expect(state().startInput).toBe('0:12.34')
      expect(state().endMs).toBe(200_000)
      expect(state().isDirty).toBe(true)
    })

    it('keeps an already chosen end when capturing the start', async () => {
      await viewModel.captureEndPosition()
      await viewModel.captureStartPosition()
      expect(state().endMs).toBe(12_340)
    })

    it('captures the current position as end', async () => {
      await viewModel.captureEndPosition()
      expect(state().endMs).toBe(12_340)
      expect(state().endInput).toBe('0:12.34')
    })
  })

  describe('typed timestamps', () => {
    it('does not change the value while typing', async () => {
      viewModel.updateStartInput('1:2')
      expect(state().startInput).toBe('1:2')
      expect(state().startMs).toBe(0)
    })

    it('commits a valid timestamp', async () => {
      viewModel.updateStartInput('1:05.50')
      viewModel.commitStartInput()
      expect(state().startMs).toBe(65_500)
    })

    it('restores the previous text when the timestamp is invalid', async () => {
      await viewModel.captureStartPosition()
      viewModel.updateStartInput('garbage')
      viewModel.commitStartInput()
      expect(state().startMs).toBe(12_340)
      expect(state().startInput).toBe('0:12.34')
    })

    it('commits a valid end timestamp', async () => {
      viewModel.updateEndInput('2:00.00')
      viewModel.commitEndInput()
      expect(state().endMs).toBe(120_000)
    })
  })

  describe('nudging', () => {
    it('moves start by 100 ms and never below zero', async () => {
      viewModel.nudgeStart(1)
      expect(state().startMs).toBe(100)
      viewModel.nudgeStart(-1)
      viewModel.nudgeStart(-1)
      expect(state().startMs).toBe(0)
    })

    it('moves end by 100 ms', async () => {
      await viewModel.captureEndPosition()
      viewModel.nudgeEnd(-1)
      expect(state().endMs).toBe(12_240)
    })
  })

  describe('loop preview', () => {
    it('previews the range after a pause', async () => {
      await viewModel.captureStartPosition()
      expect(player.activateLoop).not.toHaveBeenCalled()
      vi.advanceTimersByTime(500)
      expect(player.activateLoop).toHaveBeenCalledWith(
        { startMs: 12_340, endMs: 200_000 },
        undefined,
      )
    })

    it('previews from two seconds before the end when the end changes', async () => {
      viewModel.updateStartInput('0:10.00')
      viewModel.commitStartInput()
      viewModel.updateEndInput('0:30.00')
      viewModel.commitEndInput()
      vi.advanceTimersByTime(500)
      expect(player.activateLoop).toHaveBeenLastCalledWith(
        { startMs: 10_000, endMs: 30_000 },
        { startFrom: 28_000 },
      )
    })

    it('debounces rapid changes into a single preview', async () => {
      await viewModel.captureStartPosition()
      viewModel.nudgeStart(1)
      vi.advanceTimersByTime(500)
      expect(player.activateLoop).toHaveBeenCalledTimes(1)
    })

    it('does not preview when start is not before end', async () => {
      await viewModel.captureEndPosition()
      await viewModel.captureStartPosition()
      vi.advanceTimersByTime(500)
      expect(player.activateLoop).not.toHaveBeenCalled()
    })

    it('cancels a pending preview on cancel', async () => {
      await viewModel.captureStartPosition()
      viewModel.cancel()
      vi.advanceTimersByTime(500)
      expect(player.activateLoop).not.toHaveBeenCalled()
    })
  })

  describe('submit', () => {
    function fillValidForm() {
      viewModel.updateName('Bro')
      viewModel.updateStartInput('0:10.00')
      viewModel.commitStartInput()
      viewModel.updateEndInput('0:20.00')
      viewModel.commitEndInput()
    }

    it('rejects an empty name', async () => {
      expect(viewModel.submit()).toBe(false)
      expect(state().validationError).toBe('Gi partiet et navn')
    })

    it('rejects a whitespace-only name', async () => {
      viewModel.updateName('   ')
      expect(viewModel.submit()).toBe(false)
      expect(state().validationError).toBe('Gi partiet et navn')
    })

    it('rejects end before or at start', async () => {
      viewModel.updateName('Test')
      expect(viewModel.submit()).toBe(false)
      expect(state().validationError).toBe('Slutttidspunkt må være etter starttidspunkt')
    })

    it('clears the validation error when the name changes', async () => {
      viewModel.submit()
      viewModel.updateName('Fixed')
      expect(state().validationError).toBeNull()
    })

    it('adds a trimmed bookmark and resets the form', async () => {
      fillValidForm()
      viewModel.updateName('  Bro  ')
      expect(viewModel.submit()).toBe(true)
      expect(bookmarks.addBookmark).toHaveBeenCalledWith({
        name: 'Bro',
        startMs: 10_000,
        endMs: 20_000,
      })
      expect(state().name).toBe('')
      expect(state().isDirty).toBe(false)
    })

    it('cancels a pending preview after saving', async () => {
      fillValidForm()
      viewModel.submit()
      vi.advanceTimersByTime(500)
      expect(player.activateLoop).not.toHaveBeenCalled()
    })
  })

  describe('fresh position capture', () => {
    it('asks the player for the current position instead of using the cached state', async () => {
      playerState.update((s) => ({ ...s, positionMs: 1000 }))
      player.getCurrentPositionMs.mockResolvedValueOnce(15_555)
      await viewModel.captureStartPosition()
      expect(state().startMs).toBe(15_555)
    })

    it('uses the fresh position for the end as well', async () => {
      player.getCurrentPositionMs.mockResolvedValueOnce(42_420)
      await viewModel.captureEndPosition()
      expect(state().endMs).toBe(42_420)
      expect(state().endInput).toBe('0:42.42')
    })
  })

  describe('preview loop lifecycle', () => {
    it('stops a running preview loop on cancel', () => {
      viewModel.cancel()
      expect(player.deactivatePreviewLoop).toHaveBeenCalled()
    })

    it('stops a running preview loop after saving', () => {
      viewModel.updateName('Bro')
      viewModel.updateStartInput('0:10.00')
      viewModel.commitStartInput()
      viewModel.updateEndInput('0:20.00')
      viewModel.commitEndInput()
      player.deactivatePreviewLoop.mockClear()
      viewModel.submit()
      expect(player.deactivatePreviewLoop).toHaveBeenCalled()
    })

    it('stops a running preview loop when starting to edit a bookmark', () => {
      viewModel.beginEditing(existingBookmark)
      expect(player.deactivatePreviewLoop).toHaveBeenCalled()
    })
  })

  describe('staleness', () => {
    const otherTrack = { id: 'track-2' } as SpotifyTrack

    it('resets the form and cancels a pending preview when the track changes', async () => {
      await viewModel.captureStartPosition()
      viewModel.updateName('Old track idea')
      playerState.update((s) => ({ ...s, track: otherTrack }))
      expect(state().name).toBe('')
      expect(state().startMs).toBe(0)
      expect(state().endMs).toBe(0)
      vi.advanceTimersByTime(500)
      expect(player.activateLoop).not.toHaveBeenCalled()
    })

    it('keeps the form when the player state changes without a track change', () => {
      viewModel.updateName('Keep me')
      playerState.update((s) => ({ ...s, positionMs: 99 }))
      expect(state().name).toBe('Keep me')
    })

    it('leaves edit mode when the edited bookmark is deleted', () => {
      bookmarkList.set([existingBookmark])
      viewModel.beginEditing(existingBookmark)
      bookmarkList.set([])
      expect(state().editingBookmark).toBeNull()
      expect(state().name).toBe('')
    })

    it('stays in edit mode when other bookmarks change', () => {
      bookmarkList.set([existingBookmark])
      viewModel.beginEditing(existingBookmark)
      bookmarkList.set([existingBookmark, { ...existingBookmark, id: 'bm-2' }])
      expect(state().editingBookmark).toEqual(existingBookmark)
    })

    it('does not submit an edit for a bookmark that no longer exists', () => {
      bookmarkList.set([existingBookmark])
      viewModel.beginEditing(existingBookmark)
      bookmarkList.set([])
      viewModel.updateName('Ghost')
      expect(viewModel.submit()).toBe(false)
      expect(bookmarks.editBookmark).not.toHaveBeenCalled()
    })
  })

  describe('editing an existing bookmark', () => {
    it('populates the form from the bookmark', async () => {
      viewModel.beginEditing(existingBookmark)
      expect(state()).toMatchObject({
        name: 'Solo',
        startMs: 30_000,
        endMs: 60_000,
        startInput: '0:30.00',
        endInput: '1:00.00',
        editingBookmark: existingBookmark,
        isDirty: false,
      })
    })

    it('updates the bookmark instead of adding a new one', async () => {
      viewModel.beginEditing(existingBookmark)
      viewModel.updateName('Solo 2')
      expect(viewModel.submit()).toBe(true)
      expect(bookmarks.editBookmark).toHaveBeenCalledWith('bm-1', {
        name: 'Solo 2',
        startMs: 30_000,
        endMs: 60_000,
      })
      expect(bookmarks.addBookmark).not.toHaveBeenCalled()
      expect(state().editingBookmark).toBeNull()
    })

    it('leaves editing mode on cancel', async () => {
      viewModel.beginEditing(existingBookmark)
      viewModel.cancel()
      expect(state().editingBookmark).toBeNull()
      expect(state().name).toBe('')
    })
  })
})

type AnyMock = Mock<(...args: never[]) => unknown>
