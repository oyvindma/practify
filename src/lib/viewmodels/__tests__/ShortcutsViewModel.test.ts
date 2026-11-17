import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { get, writable } from 'svelte/store'
import type { Bookmark } from '$lib/models/bookmark'
import { INITIAL_PLAYER_STATE, type PlayerState } from '$lib/models/player'
import type { KeyPress } from '$lib/models/shortcuts'
import type { SpotifyTrack } from '$lib/models/spotify'
import type { MetronomeState } from '../MetronomeViewModel'
import { createShortcutsViewModel, type ShortcutsViewModel } from '../ShortcutsViewModel'

function makeTrack(id: string): SpotifyTrack {
  return {
    id,
    uri: `spotify:track:${id}`,
    name: id,
    duration_ms: 200_000,
    artists: [],
    album: { name: 'A', images: [] },
  }
}

const press = (key: string, overrides: Partial<KeyPress> = {}): KeyPress => ({
  key,
  isRepeat: false,
  hasCommandModifier: false,
  isTextEntry: false,
  isKeyboardFocusedControl: false,
  ...overrides,
})

const bookmark = (id: string, startMs: number, endMs: number): Bookmark => ({
  id,
  trackId: 't1',
  name: id,
  startMs,
  endMs,
})

describe('ShortcutsViewModel', () => {
  let playerState: ReturnType<typeof writable<PlayerState>>
  let metronomeState: ReturnType<typeof writable<Pick<MetronomeState, 'mode'>>>
  let sortedBookmarks: ReturnType<typeof writable<Bookmark[]>>
  let selectedId: ReturnType<typeof writable<string | null>>
  let tracks: ReturnType<typeof writable<{ tracks: SpotifyTrack[] }>>
  let nowMs: number
  let player: {
    togglePlay: Mock<() => Promise<void>>
    seek: Mock<(positionMs: number) => Promise<void>>
    getCurrentPositionMs: Mock<() => Promise<number>>
    activateLoop: Mock<(loop: Bookmark) => void>
    playTrack: Mock<(track: SpotifyTrack) => Promise<void>>
    selectTrackWithoutPlaying: Mock<(track: SpotifyTrack) => void>
  }
  let metronome: {
    toggle: Mock<() => void>
    restart: Mock<() => void>
    seekTo: Mock<(positionMs: number) => void>
    currentPracticePositionMs: Mock<() => number | null>
  }
  let bookmarks: {
    selectBookmark: Mock<(id: string | null) => void>
    selectNextBookmark: Mock<() => void>
    selectPreviousBookmark: Mock<() => void>
  }
  let editor: {
    captureStartPosition: Mock<() => Promise<void>>
    captureEndPosition: Mock<() => Promise<void>>
  }
  let viewModel: ShortcutsViewModel

  const flush = async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve()
  }
  const update = (changes: Partial<PlayerState>) =>
    playerState.update((s) => ({ ...s, ...changes }))
  const handle = (key: string, overrides: Partial<KeyPress> = {}) =>
    viewModel.handleKey(press(key, overrides))

  beforeEach(() => {
    nowMs = 0
    playerState = writable({
      ...INITIAL_PLAYER_STATE,
      track: makeTrack('t2'),
      durationMs: 200_000,
      isPlaying: true,
    })
    metronomeState = writable({ mode: 'withSong' as const })
    sortedBookmarks = writable([bookmark('a', 1000, 5000), bookmark('b', 10_000, 20_000)])
    selectedId = writable<string | null>(null)
    tracks = writable({ tracks: [makeTrack('t1'), makeTrack('t2'), makeTrack('t3')] })
    player = {
      togglePlay: vi.fn().mockResolvedValue(undefined),
      seek: vi.fn().mockResolvedValue(undefined),
      getCurrentPositionMs: vi.fn().mockResolvedValue(60_000),
      activateLoop: vi.fn(),
      playTrack: vi.fn().mockResolvedValue(undefined),
      selectTrackWithoutPlaying: vi.fn(),
    }
    metronome = {
      toggle: vi.fn(),
      restart: vi.fn(),
      seekTo: vi.fn(),
      currentPracticePositionMs: vi.fn().mockReturnValue(30_000),
    }
    bookmarks = {
      selectBookmark: vi.fn(),
      selectNextBookmark: vi.fn(),
      selectPreviousBookmark: vi.fn(),
    }
    editor = {
      captureStartPosition: vi.fn().mockResolvedValue(undefined),
      captureEndPosition: vi.fn().mockResolvedValue(undefined),
    }
    viewModel = createShortcutsViewModel(
      { playerState, ...player },
      { metronomeState: metronomeState as never, ...metronome },
      { sortedBookmarks, selectedBookmarkId: selectedId, ...bookmarks },
      editor,
      { playlistState: tracks },
      () => nowMs,
    )
  })

  it('does not handle keys that are not shortcuts', () => {
    expect(handle('x')).toBe(false)
    expect(handle(' ', { isTextEntry: true })).toBe(false)
  })

  it('does nothing without a track, apart from the cheat sheet', () => {
    update({ track: null })
    expect(handle(' ')).toBe(false)
    expect(player.togglePlay).not.toHaveBeenCalled()
    expect(handle('?')).toBe(true)
    expect(get(viewModel.isHelpOpen)).toBe(true)
  })

  describe('space', () => {
    it('plays and pauses the song in with-song mode', () => {
      expect(handle(' ')).toBe(true)
      expect(player.togglePlay).toHaveBeenCalledTimes(1)
      expect(metronome.toggle).not.toHaveBeenCalled()
    })

    it('starts and stops the practice session in silent mode', () => {
      metronomeState.set({ mode: 'silent' })
      handle(' ')
      expect(metronome.toggle).toHaveBeenCalledTimes(1)
      expect(player.togglePlay).not.toHaveBeenCalled()
    })
  })

  it('r restarts through the metronome view model', () => {
    expect(handle('r')).toBe(true)
    expect(metronome.restart).toHaveBeenCalledTimes(1)
  })

  describe('arrow left and right', () => {
    it('skips 5 seconds from the fresh song position without pausing', async () => {
      handle('ArrowRight')
      await flush()
      expect(player.seek).toHaveBeenLastCalledWith(65_000)
      handle('ArrowLeft')
      await flush()
      expect(player.seek).toHaveBeenLastCalledWith(55_000)
      expect(player.togglePlay).not.toHaveBeenCalled()
    })

    it('stays within the song', async () => {
      player.getCurrentPositionMs.mockResolvedValue(2000)
      handle('ArrowLeft')
      await flush()
      expect(player.seek).toHaveBeenLastCalledWith(0)

      player.getCurrentPositionMs.mockResolvedValue(198_000)
      handle('ArrowRight')
      await flush()
      expect(player.seek).toHaveBeenLastCalledWith(200_000)
    })

    it('moves the practice position in silent mode', async () => {
      metronomeState.set({ mode: 'silent' })
      handle('ArrowRight')
      await flush()
      expect(metronome.seekTo).toHaveBeenLastCalledWith(35_000)
      handle('ArrowLeft')
      await flush()
      expect(metronome.seekTo).toHaveBeenLastCalledWith(25_000)
      expect(player.seek).not.toHaveBeenCalled()
    })
  })

  it('1 and 2 set the loop start and end', () => {
    handle('1')
    expect(editor.captureStartPosition).toHaveBeenCalledTimes(1)
    handle('2')
    expect(editor.captureEndPosition).toHaveBeenCalledTimes(1)
  })

  it('up and down move between loops', () => {
    handle('ArrowDown')
    expect(bookmarks.selectNextBookmark).toHaveBeenCalledTimes(1)
    handle('ArrowUp')
    expect(bookmarks.selectPreviousBookmark).toHaveBeenCalledTimes(1)
  })

  describe('enter', () => {
    it('does nothing without a selected loop', () => {
      expect(handle('Enter')).toBe(true)
      expect(player.activateLoop).not.toHaveBeenCalled()
    })

    it('starts the selected loop and resumes a paused song', () => {
      selectedId.set('b')
      update({ isPlaying: false })
      handle('Enter')
      expect(player.activateLoop).toHaveBeenCalledWith(expect.objectContaining({ id: 'b' }))
      expect(player.togglePlay).toHaveBeenCalledTimes(1)
    })

    it('does not toggle a song that is already playing', () => {
      selectedId.set('a')
      handle('Enter')
      expect(player.activateLoop).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }))
      expect(player.togglePlay).not.toHaveBeenCalled()
    })

    it('starts the practice session from the loop in silent mode', () => {
      selectedId.set('a')
      metronomeState.set({ mode: 'silent' })
      handle('Enter')
      expect(player.activateLoop).toHaveBeenCalled()
      expect(metronome.restart).toHaveBeenCalledTimes(1)
      expect(player.togglePlay).not.toHaveBeenCalled()
    })
  })

  describe('next and previous track', () => {
    it('n plays the next track in the playlist', () => {
      handle('n')
      expect(player.playTrack).toHaveBeenCalledWith(expect.objectContaining({ id: 't3' }))
    })

    it('n does nothing on the last track or outside the playlist', () => {
      update({ track: makeTrack('t3') })
      handle('n')
      update({ track: makeTrack('elsewhere') })
      handle('n')
      expect(player.playTrack).not.toHaveBeenCalled()
    })

    it('p goes to the beginning first, then to the previous track on a quick second press', () => {
      handle('p')
      expect(player.seek).toHaveBeenCalledWith(0)
      expect(player.playTrack).not.toHaveBeenCalled()

      nowMs = 1500
      handle('p')
      expect(player.playTrack).toHaveBeenCalledWith(expect.objectContaining({ id: 't1' }))
    })

    it('p goes to the beginning again when the second press comes late', () => {
      handle('p')
      nowMs = 10_000
      handle('p')
      expect(player.seek).toHaveBeenCalledTimes(2)
      expect(player.playTrack).not.toHaveBeenCalled()
    })

    it('needs a fresh first press after going to the previous track', () => {
      handle('p')
      nowMs = 1000
      handle('p')
      nowMs = 1500
      handle('p')
      expect(player.playTrack).toHaveBeenCalledTimes(1)
      expect(player.seek).toHaveBeenCalledTimes(2)
    })

    it('p stays at the beginning on the first track', () => {
      update({ track: makeTrack('t1') })
      handle('p')
      nowMs = 500
      handle('p')
      expect(player.playTrack).not.toHaveBeenCalled()
    })

    it('n and a quick double p switch track without playing in silent mode', () => {
      metronomeState.set({ mode: 'silent' })
      handle('n')
      expect(player.selectTrackWithoutPlaying).toHaveBeenLastCalledWith(
        expect.objectContaining({ id: 't3' }),
      )
      handle('p')
      nowMs = 1000
      handle('p')
      expect(player.selectTrackWithoutPlaying).toHaveBeenLastCalledWith(
        expect.objectContaining({ id: 't1' }),
      )
      expect(player.playTrack).not.toHaveBeenCalled()
    })

    it('p moves the practice position to 0 in silent mode', () => {
      metronomeState.set({ mode: 'silent' })
      handle('p')
      expect(metronome.seekTo).toHaveBeenCalledWith(0)
      expect(player.seek).not.toHaveBeenCalled()
    })
  })

  describe('cheat sheet', () => {
    it('toggles with ? and closes with Escape', () => {
      handle('?')
      expect(get(viewModel.isHelpOpen)).toBe(true)
      handle('?')
      expect(get(viewModel.isHelpOpen)).toBe(false)
      handle('?')
      expect(handle('Escape')).toBe(true)
      expect(get(viewModel.isHelpOpen)).toBe(false)
    })

    it('leaves Escape alone when the cheat sheet is closed', () => {
      expect(handle('Escape')).toBe(false)
    })

    it('blocks other shortcuts while it is open', () => {
      handle('?')
      expect(handle(' ')).toBe(false)
      expect(handle('n')).toBe(false)
      expect(player.togglePlay).not.toHaveBeenCalled()
      expect(player.playTrack).not.toHaveBeenCalled()
    })
  })
})
