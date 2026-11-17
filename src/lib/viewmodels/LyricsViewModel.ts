import { derived, readable, type Readable } from 'svelte/store'
import { findActiveLineIndex, type Lyrics } from '$lib/models/lyrics'
import type { PlayerState } from '$lib/models/player'
import type { ILyricsService } from '$lib/services/LyricsService'
import type { ILyricsStorageService } from '$lib/services/LyricsStorageService'

export interface LyricsState {
  status: 'idle' | 'loading' | 'found' | 'notFound' | 'error'
  lyrics: Lyrics | null
}

export interface LyricsViewModel {
  lyricsState: Readable<LyricsState>
  activeLineIndex: Readable<number>
}

export interface LyricsPlayerSource {
  playerState: Readable<PlayerState>
  displayPositionMs: Readable<number>
}

const IDLE: LyricsState = { status: 'idle', lyrics: null }

export function createLyricsViewModel(
  player: LyricsPlayerSource,
  lyricsService: ILyricsService,
  lyricsStorage: ILyricsStorageService,
): LyricsViewModel {
  // Loads only while something is subscribed, and cleans up its player subscription afterwards.
  const lyricsState = readable<LyricsState>(IDLE, (set) => {
    let loadedTrackId: string | null = null

    const unsubscribe = player.playerState.subscribe(({ track }) => {
      const trackId = track?.id ?? null
      if (trackId === loadedTrackId) return
      loadedTrackId = trackId

      if (!track) {
        set(IDLE)
        return
      }
      const cached = lyricsStorage.getLyrics(track.id)
      if (cached) {
        set({ status: 'found', lyrics: cached })
        return
      }

      set({ status: 'loading', lyrics: null })
      lyricsService
        .getLyrics({
          trackName: track.name,
          artistName: track.artists[0]?.name ?? '',
          albumName: track.album.name,
          durationMs: track.duration_ms,
        })
        .then((lyrics) => {
          if (loadedTrackId !== trackId) return
          if (lyrics) lyricsStorage.saveLyrics(track.id, lyrics)
          set(lyrics ? { status: 'found', lyrics } : { status: 'notFound', lyrics: null })
        })
        .catch(() => {
          if (loadedTrackId !== trackId) return
          set({ status: 'error', lyrics: null })
        })
    })

    return () => {
      unsubscribe()
      loadedTrackId = null
    }
  })

  return {
    lyricsState,
    activeLineIndex: derived([lyricsState, player.displayPositionMs], ([state, positionMs]) =>
      findActiveLineIndex(state.lyrics, positionMs),
    ),
  }
}
