import { describe, it, expect, beforeEach, vi } from 'vitest'
import { get, writable } from 'svelte/store'
import { INITIAL_PLAYER_STATE, type PlayerState } from '$lib/models/player'
import type { Lyrics } from '$lib/models/lyrics'
import type { SpotifyTrack } from '$lib/models/spotify'
import { createLyricsViewModel } from '../LyricsViewModel'

function makeTrack(id: string): SpotifyTrack {
  return {
    id,
    uri: `spotify:track:${id}`,
    name: `Song ${id}`,
    duration_ms: 200_000,
    artists: [{ name: 'Band' }],
    album: { name: 'Album', images: [] },
  }
}

const lyrics: Lyrics = {
  synced: true,
  lines: [
    { startMs: 1000, text: 'a' },
    { startMs: 2000, text: 'b' },
  ],
}

describe('LyricsViewModel', () => {
  let playerState: ReturnType<typeof writable<PlayerState>>
  let position: ReturnType<typeof writable<number>>
  let getLyrics: ReturnType<typeof vi.fn>

  let storage: { getLyrics: ReturnType<typeof vi.fn>; saveLyrics: ReturnType<typeof vi.fn> }

  function create() {
    return createLyricsViewModel(
      { playerState, displayPositionMs: position },
      { getLyrics: getLyrics as never },
      storage as never,
    )
  }

  beforeEach(() => {
    playerState = writable({ ...INITIAL_PLAYER_STATE })
    position = writable(0)
    getLyrics = vi.fn().mockResolvedValue(lyrics)
    storage = { getLyrics: vi.fn().mockReturnValue(null), saveLyrics: vi.fn() }
  })

  it('uses stored lyrics without calling LRCLIB', () => {
    storage.getLyrics.mockReturnValue(lyrics)
    const vm = create()
    const unsubscribe = vm.lyricsState.subscribe(() => {})
    playerState.update((s) => ({ ...s, track: makeTrack('1') }))
    expect(storage.getLyrics).toHaveBeenCalledWith('1')
    expect(get(vm.lyricsState)).toEqual({ status: 'found', lyrics })
    expect(getLyrics).not.toHaveBeenCalled()
    unsubscribe()
  })

  it('stores fetched lyrics but not misses', async () => {
    getLyrics.mockResolvedValueOnce(lyrics).mockResolvedValueOnce(null)
    const vm = create()
    const unsubscribe = vm.lyricsState.subscribe(() => {})
    playerState.update((s) => ({ ...s, track: makeTrack('1') }))
    await vi.waitFor(() => expect(get(vm.lyricsState).status).toBe('found'))
    expect(storage.saveLyrics).toHaveBeenCalledWith('1', lyrics)

    playerState.update((s) => ({ ...s, track: makeTrack('2') }))
    await vi.waitFor(() => expect(get(vm.lyricsState).status).toBe('notFound'))
    expect(storage.saveLyrics).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('is idle without a track', () => {
    expect(get(create().lyricsState).status).toBe('idle')
  })

  it('loads lyrics for the playing track', async () => {
    const vm = create()
    const seen: string[] = []
    const unsubscribe = vm.lyricsState.subscribe((s) => seen.push(s.status))
    playerState.update((s) => ({ ...s, track: makeTrack('1') }))
    await vi.waitFor(() => expect(seen.at(-1)).toBe('found'))
    expect(seen).toContain('loading')
    expect(getLyrics).toHaveBeenCalledWith({
      trackName: 'Song 1',
      artistName: 'Band',
      albumName: 'Album',
      durationMs: 200_000,
    })
    unsubscribe()
  })

  it('does not refetch when only position changes', async () => {
    const vm = create()
    const unsubscribe = vm.lyricsState.subscribe(() => {})
    playerState.update((s) => ({ ...s, track: makeTrack('1') }))
    playerState.update((s) => ({ ...s, positionMs: 5000 }))
    expect(getLyrics).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('reports notFound and error', async () => {
    getLyrics.mockResolvedValueOnce(null)
    const vm = create()
    const unsubscribe = vm.lyricsState.subscribe(() => {})
    playerState.update((s) => ({ ...s, track: makeTrack('1') }))
    await vi.waitFor(() => expect(get(vm.lyricsState).status).toBe('notFound'))

    getLyrics.mockRejectedValueOnce(new Error('boom'))
    playerState.update((s) => ({ ...s, track: makeTrack('2') }))
    await vi.waitFor(() => expect(get(vm.lyricsState).status).toBe('error'))
    unsubscribe()
  })

  it('ignores a slow response for a previous track', async () => {
    let resolveFirst: (value: Lyrics) => void = () => {}
    getLyrics
      .mockReturnValueOnce(new Promise((resolve) => (resolveFirst = resolve)))
      .mockResolvedValueOnce(null)
    const vm = create()
    const unsubscribe = vm.lyricsState.subscribe(() => {})
    playerState.update((s) => ({ ...s, track: makeTrack('1') }))
    playerState.update((s) => ({ ...s, track: makeTrack('2') }))
    await vi.waitFor(() => expect(get(vm.lyricsState).status).toBe('notFound'))
    resolveFirst(lyrics)
    await Promise.resolve()
    expect(get(vm.lyricsState).status).toBe('notFound')
    unsubscribe()
  })

  it('derives the active line from the display position', async () => {
    const vm = create()
    const unsubscribe = vm.lyricsState.subscribe(() => {})
    playerState.update((s) => ({ ...s, track: makeTrack('1') }))
    await vi.waitFor(() => expect(get(vm.lyricsState).status).toBe('found'))
    position.set(500)
    expect(get(vm.activeLineIndex)).toBe(-1)
    position.set(2100)
    expect(get(vm.activeLineIndex)).toBe(1)
    unsubscribe()
  })
})
