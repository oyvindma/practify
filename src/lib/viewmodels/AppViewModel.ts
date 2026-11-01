import { derived, type Readable } from 'svelte/store'
import type { PlayerState } from '$lib/models/player'
import type { Bookmark } from '$lib/models/bookmark'
import type { AuthViewModel } from './AuthViewModel'
import type { BookmarkViewModel } from './BookmarkViewModel'
import type { PlayerViewModel } from './PlayerViewModel'
import { isOAuthCallback } from './CallbackViewModel'

export interface AppViewModel {
  isCallbackRoute: boolean
  isAuthenticated: Readable<boolean>

  start(): () => void
}

function keepActiveLoopInSyncWithBookmarks(
  playerState: PlayerState,
  bookmarks: Bookmark[],
  player: Pick<PlayerViewModel, 'retimeActiveLoop' | 'deactivateLoop'>,
) {
  const activeLoop = playerState.activeLoop
  if (!activeLoop?.id) return

  const bookmark = bookmarks.find((b) => b.id === activeLoop.id)
  if (!bookmark) {
    player.deactivateLoop()
  } else if (bookmark.startMs !== activeLoop.startMs || bookmark.endMs !== activeLoop.endMs) {
    player.retimeActiveLoop(bookmark)
  }
}

export function createAppViewModel(
  locationSearch: string,
  auth: Pick<AuthViewModel, 'isAuthenticated'>,
  player: PlayerViewModel,
  bookmarks: BookmarkViewModel,
): AppViewModel {
  const isCallbackRoute = isOAuthCallback(locationSearch)

  return {
    isCallbackRoute,
    isAuthenticated: auth.isAuthenticated,

    start() {
      let wasAuthenticated = false
      const stopAuthSync = auth.isAuthenticated.subscribe((isAuthenticated) => {
        if (isAuthenticated && !isCallbackRoute) void player.init()
        else if (wasAuthenticated && !isAuthenticated) player.destroy()
        wasAuthenticated = isAuthenticated
      })

      const stopTrackSync = player.playerState.subscribe((state) => {
        bookmarks.showBookmarksForTrack(state.track?.id ?? null)
      })
      const stopLoopSync = derived(
        [player.playerState, bookmarks.sortedBookmarks],
        ([playerState, sortedBookmarks]) => ({ playerState, sortedBookmarks }),
      ).subscribe(({ playerState, sortedBookmarks }) => {
        keepActiveLoopInSyncWithBookmarks(playerState, sortedBookmarks, player)
      })

      return () => {
        stopAuthSync()
        stopTrackSync()
        stopLoopSync()
        player.destroy()
      }
    },
  }
}
