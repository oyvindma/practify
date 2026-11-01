import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { writable } from 'svelte/store'
import { INITIAL_PLAYER_STATE, type PlayerState } from '$lib/models/player'
import type { Bookmark } from '$lib/models/bookmark'
import type { SpotifyTrack } from '$lib/models/spotify'
import { createAppViewModel } from '../AppViewModel'

const track = { id: 'track-1' } as SpotifyTrack
const bookmark: Bookmark = { id: 'bm', trackId: 'track-1', name: 'A', startMs: 1000, endMs: 2000 }

describe('AppViewModel', () => {
  let playerState: ReturnType<typeof writable<PlayerState>>
  let bookmarks: ReturnType<typeof writable<Bookmark[]>>
  let isAuthenticated: ReturnType<typeof writable<boolean>>
  let player: {
    playerState: typeof playerState
    init: AnyMock
    destroy: AnyMock
    retimeActiveLoop: AnyMock
    deactivateLoop: AnyMock
  }
  let bookmarkViewModel: {
    sortedBookmarks: typeof bookmarks
    showBookmarksForTrack: AnyMock
  }

  function create(search = '') {
    return createAppViewModel(
      search,
      { isAuthenticated },
      player as never,
      bookmarkViewModel as never,
    )
  }

  beforeEach(() => {
    playerState = writable({ ...INITIAL_PLAYER_STATE })
    bookmarks = writable([])
    isAuthenticated = writable(true)
    player = {
      playerState,
      init: vi.fn(),
      destroy: vi.fn(),
      retimeActiveLoop: vi.fn(),
      deactivateLoop: vi.fn(),
    }
    bookmarkViewModel = { sortedBookmarks: bookmarks, showBookmarksForTrack: vi.fn() }
  })

  it('detects the OAuth callback route', () => {
    expect(create('?code=abc').isCallbackRoute).toBe(true)
    expect(create('').isCallbackRoute).toBe(false)
  })

  it('initialises the player when authenticated', () => {
    create().start()
    expect(player.init).toHaveBeenCalled()
  })

  it('does not initialise the player when logged out', () => {
    isAuthenticated.set(false)
    create().start()
    expect(player.init).not.toHaveBeenCalled()
  })

  it('does not initialise the player on the callback route', () => {
    create('?code=abc').start()
    expect(player.init).not.toHaveBeenCalled()
  })

  describe('auth lifecycle', () => {
    it('destroys the player when the user logs out', () => {
      create().start()
      player.destroy.mockClear()
      isAuthenticated.set(false)
      expect(player.destroy).toHaveBeenCalledTimes(1)
    })

    it('does not destroy the player on start when logged out', () => {
      isAuthenticated.set(false)
      create().start()
      expect(player.destroy).not.toHaveBeenCalled()
    })

    it('initialises the player when the user logs in later', () => {
      isAuthenticated.set(false)
      create().start()
      isAuthenticated.set(true)
      expect(player.init).toHaveBeenCalledTimes(1)
    })

    it('clears the bookmarks shown for the track after logout resets the player', () => {
      create().start()
      playerState.update((s) => ({ ...s, track }))
      isAuthenticated.set(false)
      playerState.set({ ...INITIAL_PLAYER_STATE })
      expect(bookmarkViewModel.showBookmarksForTrack).toHaveBeenLastCalledWith(null)
    })

    it('stops reacting to auth changes after stop', () => {
      const stop = create().start()
      stop()
      player.init.mockClear()
      player.destroy.mockClear()
      isAuthenticated.set(false)
      isAuthenticated.set(true)
      expect(player.init).not.toHaveBeenCalled()
      expect(player.destroy).toHaveBeenCalledTimes(0)
    })
  })

  it('shows bookmarks of the active track', () => {
    create().start()
    playerState.update((s) => ({ ...s, track }))
    expect(bookmarkViewModel.showBookmarksForTrack).toHaveBeenLastCalledWith('track-1')
  })

  describe('active loop sync', () => {
    function startWithActiveLoop(loop: { id: string | null; startMs: number; endMs: number }) {
      bookmarks.set([bookmark])
      playerState.update((s) => ({ ...s, activeLoop: loop }))
      create().start()
    }

    it('deactivates the loop when its bookmark is deleted', () => {
      startWithActiveLoop({ id: 'bm', startMs: 1000, endMs: 2000 })
      bookmarks.set([])
      expect(player.deactivateLoop).toHaveBeenCalled()
    })

    it('retimes the loop without restarting it when its bookmark range changes', () => {
      startWithActiveLoop({ id: 'bm', startMs: 1000, endMs: 2000 })
      bookmarks.set([{ ...bookmark, endMs: 3000 }])
      expect(player.retimeActiveLoop).toHaveBeenCalledWith({ ...bookmark, endMs: 3000 })
    })

    it('leaves a matching loop alone', () => {
      startWithActiveLoop({ id: 'bm', startMs: 1000, endMs: 2000 })
      expect(player.retimeActiveLoop).not.toHaveBeenCalled()
      expect(player.deactivateLoop).not.toHaveBeenCalled()
    })

    it('ignores preview loops that have no bookmark id', () => {
      startWithActiveLoop({ id: null, startMs: 5, endMs: 10 })
      bookmarks.set([])
      expect(player.deactivateLoop).not.toHaveBeenCalled()
    })
  })

  it('stops syncing and destroys the player on stop', () => {
    const stop = create().start()
    stop()
    expect(player.destroy).toHaveBeenCalled()
    bookmarkViewModel.showBookmarksForTrack.mockClear()
    playerState.update((s) => ({ ...s, track }))
    expect(bookmarkViewModel.showBookmarksForTrack).not.toHaveBeenCalled()
  })
})

type AnyMock = Mock<(...args: never[]) => unknown>
