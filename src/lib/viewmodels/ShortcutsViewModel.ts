import { get, writable, type Readable } from 'svelte/store'
import type { Bookmark } from '$lib/models/bookmark'
import type { PlayerState } from '$lib/models/player'
import { SKIP_MS, resolveShortcut, type KeyPress, type ShortcutAction } from '$lib/models/shortcuts'
import type { SpotifyTrack } from '$lib/models/spotify'
import type { LoopRange } from '$lib/playback/LoopEngine'
import type { MetronomeState } from './MetronomeViewModel'
import type { PlaylistState } from './PlaylistViewModel'

export interface ShortcutsViewModel {
  isHelpOpen: Readable<boolean>

  // Returns true when the key was a shortcut, so the view can stop the browser's own handling
  handleKey(press: KeyPress): boolean
  toggleHelp(): void
  closeHelp(): void
}

export interface ShortcutsPlayer {
  playerState: Readable<PlayerState>
  togglePlay(): Promise<void>
  seek(positionMs: number): Promise<void>
  getCurrentPositionMs(): Promise<number>
  activateLoop(loop: LoopRange & { id: string }): void
  playTrack(track: SpotifyTrack): Promise<void>
  selectTrackWithoutPlaying(track: SpotifyTrack): void
}

export interface ShortcutsMetronome {
  metronomeState: Readable<MetronomeState>
  toggle(): void
  restart(): void
  seekTo(positionMs: number): void
  currentPracticePositionMs(): number | null
}

export interface ShortcutsBookmarks {
  sortedBookmarks: Readable<Bookmark[]>
  selectedBookmarkId: Readable<string | null>
  selectBookmark(bookmarkId: string | null): void
  selectNextBookmark(): void
  selectPreviousBookmark(): void
}

export interface ShortcutsEditor {
  captureStartPosition(): Promise<void>
  captureEndPosition(): Promise<void>
}

export interface ShortcutsPlaylist {
  playlistState: Readable<Pick<PlaylistState, 'tracks'>>
}

const DOUBLE_PRESS_MS = 3000

export function createShortcutsViewModel(
  player: ShortcutsPlayer,
  metronome: ShortcutsMetronome,
  bookmarks: ShortcutsBookmarks,
  editor: ShortcutsEditor,
  playlist: ShortcutsPlaylist,
  now: () => number = Date.now,
): ShortcutsViewModel {
  const helpStore = writable(false)
  let lastBeginningPressAtMs: number | null = null

  const playerState = () => get(player.playerState)
  const isSilent = () => get(metronome.metronomeState).mode === 'silent'

  function toggleHelp() {
    helpStore.update((isOpen) => !isOpen)
  }

  function closeHelp() {
    helpStore.set(false)
  }

  function togglePlay() {
    if (isSilent()) metronome.toggle()
    else void player.togglePlay()
  }

  async function skip(deltaMs: number) {
    const { durationMs } = playerState()
    const clamp = (positionMs: number) => Math.min(durationMs, Math.max(0, positionMs))
    if (isSilent()) {
      metronome.seekTo(clamp((metronome.currentPracticePositionMs() ?? 0) + deltaMs))
      return
    }
    const positionMs = await player.getCurrentPositionMs()
    await player.seek(clamp(positionMs + deltaMs))
  }

  function playSelectedLoop() {
    const selectedId = get(bookmarks.selectedBookmarkId)
    const loop = get(bookmarks.sortedBookmarks).find((bookmark) => bookmark.id === selectedId)
    if (!loop) return
    player.activateLoop(loop)
    if (isSilent()) {
      metronome.restart()
      return
    }
    if (!playerState().isPlaying) void player.togglePlay()
  }

  function adjacentTrack(offset: 1 | -1): SpotifyTrack | null {
    const currentId = playerState().track?.id
    const { tracks } = get(playlist.playlistState)
    const currentIndex = tracks.findIndex((track) => track.id === currentId)
    if (currentIndex === -1) return null
    return tracks[currentIndex + offset] ?? null
  }

  function playAdjacentTrack(offset: 1 | -1) {
    const track = adjacentTrack(offset)
    if (!track) return
    // Silent practice carries on with the new track instead of starting Spotify
    if (isSilent()) player.selectTrackWithoutPlaying(track)
    else void player.playTrack(track)
  }

  // First press goes to the beginning; pressing again soon after goes to the previous song
  function previousOrBeginning() {
    const pressedAtMs = now()
    const isSecondPress =
      lastBeginningPressAtMs !== null && pressedAtMs - lastBeginningPressAtMs <= DOUBLE_PRESS_MS
    if (isSecondPress) {
      lastBeginningPressAtMs = null
      playAdjacentTrack(-1)
      return
    }
    lastBeginningPressAtMs = pressedAtMs
    if (isSilent()) metronome.seekTo(0)
    else void player.seek(0)
  }

  const actions: Record<Exclude<ShortcutAction, 'toggleHelp' | 'closeHelp'>, () => void> = {
    togglePlay,
    restart: () => metronome.restart(),
    skipBack: () => void skip(-SKIP_MS),
    skipForward: () => void skip(SKIP_MS),
    setLoopStart: () => void editor.captureStartPosition(),
    setLoopEnd: () => void editor.captureEndPosition(),
    selectPreviousLoop: () => bookmarks.selectPreviousBookmark(),
    selectNextLoop: () => bookmarks.selectNextBookmark(),
    playSelectedLoop,
    nextTrack: () => playAdjacentTrack(1),
    previousTrack: previousOrBeginning,
  }

  return {
    isHelpOpen: { subscribe: helpStore.subscribe },

    handleKey(press) {
      const action = resolveShortcut(press)
      if (!action) return false

      if (action === 'toggleHelp') {
        toggleHelp()
        return true
      }
      if (action === 'closeHelp') {
        if (!get(helpStore)) return false
        closeHelp()
        return true
      }
      // The cheat sheet is modal: everything else waits until it is closed
      if (get(helpStore)) return false
      if (!playerState().track) return false

      actions[action]()
      return true
    },

    toggleHelp,
    closeHelp,
  }
}
