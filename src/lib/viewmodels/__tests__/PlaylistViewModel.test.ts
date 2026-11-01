import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { get } from 'svelte/store'
import type { SpotifyPlaylist, SpotifyTrack } from '$lib/models/spotify'
import type { ISpotifyApiService } from '$lib/services/SpotifyApiService'
import { createPlaylistViewModel, type PlaylistViewModel } from '../PlaylistViewModel'

const playlist = (id: string): SpotifyPlaylist => ({
  id,
  name: `List ${id}`,
  images: [],
  items: null,
})
const track = (id: string): SpotifyTrack => ({
  id,
  uri: `spotify:track:${id}`,
  name: id,
  duration_ms: 1000,
  artists: [],
  album: { name: 'A', images: [] },
})

describe('PlaylistViewModel', () => {
  let api: ISpotifyApiService & {
    getUserPlaylists: AnyMock
    getPlaylistTracks: AnyMock
  }
  let viewModel: PlaylistViewModel
  const state = () => get(viewModel.playlistState)

  beforeEach(() => {
    api = {
      getCurrentUser: vi.fn(),
      startPlayback: vi.fn(),
      getUserPlaylists: vi.fn().mockResolvedValue([playlist('a')]),
      getPlaylistTracks: vi.fn().mockResolvedValue([track('t1')]),
    }
    viewModel = createPlaylistViewModel(api)
  })

  it('starts in a loading state', () => {
    expect(state().isLoadingPlaylists).toBe(true)
    expect(state().playlists).toEqual([])
  })

  it('loads playlists', async () => {
    await viewModel.loadPlaylists()
    expect(state().playlists.map((p) => p.id)).toEqual(['a'])
    expect(state().isLoadingPlaylists).toBe(false)
  })

  it('only fetches playlists once', async () => {
    await Promise.all([viewModel.loadPlaylists(), viewModel.loadPlaylists()])
    await viewModel.loadPlaylists()
    expect(api.getUserPlaylists).toHaveBeenCalledTimes(1)
  })

  it('exposes the error and allows a retry', async () => {
    api.getUserPlaylists.mockRejectedValueOnce(new Error('boom'))
    await viewModel.loadPlaylists()
    expect(state().playlistsError).toBe('boom')
    expect(state().isLoadingPlaylists).toBe(false)

    await viewModel.loadPlaylists()
    expect(state().playlistsError).toBeNull()
    expect(state().playlists).toHaveLength(1)
  })

  it('uses a fallback message for non-Error failures', async () => {
    api.getUserPlaylists.mockRejectedValueOnce('nope')
    await viewModel.loadPlaylists()
    expect(state().playlistsError).toBe('Kunne ikke hente spillelister')
  })

  it('selects a playlist and loads its tracks', async () => {
    const promise = viewModel.selectPlaylist(playlist('a'))
    expect(state().selectedPlaylist?.id).toBe('a')
    expect(state().isLoadingTracks).toBe(true)
    await promise
    expect(state().tracks.map((t) => t.id)).toEqual(['t1'])
    expect(state().isLoadingTracks).toBe(false)
  })

  it('exposes track loading errors', async () => {
    api.getPlaylistTracks.mockRejectedValueOnce(new Error('denied'))
    await viewModel.selectPlaylist(playlist('a'))
    expect(state().tracksError).toBe('denied')
  })

  it('ignores tracks that arrive after the selection was cleared', async () => {
    const promise = viewModel.selectPlaylist(playlist('a'))
    viewModel.clearSelection()
    await promise
    expect(state().selectedPlaylist).toBeNull()
    expect(state().tracks).toEqual([])
  })

  it('ignores stale tracks when another playlist was selected meanwhile', async () => {
    let resolveFirst: (tracks: SpotifyTrack[]) => void = () => {}
    api.getPlaylistTracks.mockReturnValueOnce(new Promise((resolve) => (resolveFirst = resolve)))
    const first = viewModel.selectPlaylist(playlist('a'))
    await viewModel.selectPlaylist(playlist('b'))
    resolveFirst([track('stale')])
    await first
    expect(state().selectedPlaylist?.id).toBe('b')
    expect(state().tracks.map((t) => t.id)).toEqual(['t1'])
  })
})

type AnyMock = Mock<(...args: never[]) => unknown>
