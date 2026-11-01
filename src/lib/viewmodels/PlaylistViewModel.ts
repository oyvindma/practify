import { writable, get, type Readable } from 'svelte/store'
import type { SpotifyPlaylist, SpotifyTrack } from '$lib/models/spotify'
import type { ISpotifyApiService } from '$lib/services/SpotifyApiService'

export interface PlaylistState {
  playlists: SpotifyPlaylist[]
  isLoadingPlaylists: boolean
  playlistsError: string | null
  selectedPlaylist: SpotifyPlaylist | null
  tracks: SpotifyTrack[]
  isLoadingTracks: boolean
  tracksError: string | null
}

export interface PlaylistViewModel {
  playlistState: Readable<PlaylistState>

  loadPlaylists(): Promise<void>
  selectPlaylist(playlist: SpotifyPlaylist): Promise<void>
  clearSelection(): void
}

const INITIAL_STATE: PlaylistState = {
  playlists: [],
  isLoadingPlaylists: true,
  playlistsError: null,
  selectedPlaylist: null,
  tracks: [],
  isLoadingTracks: false,
  tracksError: null,
}

function errorMessageOr(fallback: string, error: unknown): string {
  return error instanceof Error ? error.message : fallback
}

export function createPlaylistViewModel(apiService: ISpotifyApiService): PlaylistViewModel {
  const stateStore = writable<PlaylistState>({ ...INITIAL_STATE })
  let playlistsRequested = false

  return {
    playlistState: { subscribe: stateStore.subscribe },

    async loadPlaylists() {
      if (playlistsRequested) return
      playlistsRequested = true
      stateStore.update((s) => ({ ...s, isLoadingPlaylists: true, playlistsError: null }))
      try {
        const playlists = await apiService.getUserPlaylists()
        stateStore.update((s) => ({ ...s, playlists, isLoadingPlaylists: false }))
      } catch (e) {
        playlistsRequested = false
        stateStore.update((s) => ({
          ...s,
          isLoadingPlaylists: false,
          playlistsError: errorMessageOr('Kunne ikke hente spillelister', e),
        }))
      }
    },

    async selectPlaylist(playlist: SpotifyPlaylist) {
      stateStore.update((s) => ({
        ...s,
        selectedPlaylist: playlist,
        tracks: [],
        isLoadingTracks: true,
        tracksError: null,
      }))
      const isStillSelected = () => get(stateStore).selectedPlaylist?.id === playlist.id
      try {
        const tracks = await apiService.getPlaylistTracks(playlist.id)
        if (!isStillSelected()) return
        stateStore.update((s) => ({ ...s, tracks, isLoadingTracks: false }))
      } catch (e) {
        if (!isStillSelected()) return
        stateStore.update((s) => ({
          ...s,
          isLoadingTracks: false,
          tracksError: errorMessageOr('Kunne ikke hente låter', e),
        }))
      }
    },

    clearSelection() {
      stateStore.update((s) => ({
        ...s,
        selectedPlaylist: null,
        tracks: [],
        isLoadingTracks: false,
        tracksError: null,
      }))
    },
  }
}
