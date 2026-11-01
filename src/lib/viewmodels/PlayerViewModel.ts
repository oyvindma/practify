import { writable, derived, get, type Readable } from 'svelte/store'
import {
  INITIAL_PLAYER_STATE,
  toLoopRegion,
  type LoopRegion,
  type PlayerState,
} from '$lib/models/player'
import type { SpotifyTrack } from '$lib/models/spotify'
import { LoopEngine, type LoopRange as TimeRange } from '$lib/playback/LoopEngine'
import type { ISpotifyApiService } from '$lib/services/SpotifyApiService'
import type { ISpotifyPlayerService, PlayerErrorKind } from '$lib/services/SpotifyPlayerService'

const SCRUB_SEEK_THROTTLE_MS = 200

const NOT_READY_MESSAGE = 'Spilleren er ikke klar ennå – prøv igjen om et øyeblikk'

export interface LoopRange extends TimeRange {
  id?: string | null
}

export interface ActivateLoopOptions {
  startFrom?: number
}

export interface PlayerViewModel {
  playerState: Readable<PlayerState>
  loopRegion: Readable<LoopRegion | null>
  displayPositionMs: Readable<number>

  init(): Promise<void>
  destroy(): void
  playTrack(track: SpotifyTrack): Promise<void>
  togglePlay(): Promise<void>
  seek(positionMs: number): Promise<void>
  scrubTo(positionMs: number): void
  commitScrub(positionMs: number): Promise<void>
  getCurrentPositionMs(): Promise<number>
  activateLoop(loop: LoopRange, options?: ActivateLoopOptions): void
  retimeActiveLoop(loop: LoopRange & { id: string }): void
  deactivateLoop(): void
  deactivatePreviewLoop(): void
  toggleLoop(loop: LoopRange & { id: string }): void
}

export interface AccessTokenSource {
  getValidToken(): Promise<string | null>
}

export function createPlayerViewModel(
  playerService: ISpotifyPlayerService,
  apiService: ISpotifyApiService,
  auth: AccessTokenSource,
): PlayerViewModel {
  const stateStore = writable<PlayerState>({ ...INITIAL_PLAYER_STATE })
  let isInitialised = false
  let pendingTrackId: string | null = null
  let scrubTimer: ReturnType<typeof setTimeout> | null = null
  let lastScrubSeekMs: number | null = null

  function updatePosition(positionMs: number) {
    stateStore.update((s) => ({ ...s, positionMs }))
  }

  const loopEngine = new LoopEngine(playerService, updatePosition)

  function activateLoop(loop: LoopRange, options?: ActivateLoopOptions) {
    stateStore.update((s) => ({
      ...s,
      activeLoop: { id: loop.id ?? null, startMs: loop.startMs, endMs: loop.endMs },
    }))
    loopEngine.startLoop({ startMs: loop.startMs, endMs: loop.endMs }, options?.startFrom)
  }

  function deactivateLoop() {
    stateStore.update((s) => ({ ...s, activeLoop: null }))
    loopEngine.stopLoop()
  }

  function describe(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
  }

  function setPlaybackError(playbackError: string | null) {
    stateStore.update((s) => ({ ...s, playbackError }))
  }

  async function seekSafely(positionMs: number) {
    try {
      await playerService.seek(positionMs)
    } catch (error) {
      setPlaybackError(`Kunne ikke spole: ${describe(error)}`)
    }
  }

  function cancelScrubTimer() {
    if (scrubTimer === null) return
    clearTimeout(scrubTimer)
    scrubTimer = null
  }

  function sendPendingScrubSeek(): boolean {
    const { scrubPositionMs } = get(stateStore)
    if (scrubPositionMs === null || scrubPositionMs === lastScrubSeekMs) return false
    lastScrubSeekMs = scrubPositionMs
    void seekSafely(scrubPositionMs)
    return true
  }

  function armScrubTimer() {
    scrubTimer = setTimeout(() => {
      scrubTimer = null
      if (sendPendingScrubSeek()) armScrubTimer()
    }, SCRUB_SEEK_THROTTLE_MS)
  }

  function adoptTrackReportedBySdk(sdkTrack: SpotifyTrack | null | undefined) {
    if (!sdkTrack) return
    if (pendingTrackId !== null) {
      if (sdkTrack.id === pendingTrackId) pendingTrackId = null
      return
    }
    if (get(stateStore).track?.id === sdkTrack.id) return
    loopEngine.stopLoop()
    stateStore.update((s) => ({ ...s, track: sdkTrack, activeLoop: null }))
  }

  function describePlayerError(kind: PlayerErrorKind, message: string): string {
    switch (kind) {
      case 'account':
        return 'Spotify Premium kreves for avspilling i nettleseren'
      case 'authentication':
        return 'Spotify avviste innloggingen for spilleren – logg ut og inn igjen'
      case 'initialization':
        return `Spotify-spilleren kunne ikke startes i denne nettleseren (${message})`
      case 'playback':
        return `Avspillingsfeil: ${message}`
    }
  }

  function connectPlayer() {
    return playerService.connect(() => auth.getValidToken(), {
      onReady: (deviceId) => {
        stateStore.update((s) => ({ ...s, isReady: true, deviceId }))
      },
      onNotReady: () => {
        stateStore.update((s) => ({ ...s, isReady: false, deviceId: null }))
      },
      onPlaybackChanged: (snapshot) => {
        stateStore.update((s) => ({
          ...s,
          positionMs: snapshot.positionMs,
          durationMs: snapshot.durationMs,
          isPlaying: !snapshot.isPaused,
        }))
        adoptTrackReportedBySdk(snapshot.track)
        loopEngine.setPlaying(!snapshot.isPaused)
      },
      onError: (kind, message) => {
        const description = describePlayerError(kind, message)
        if (kind === 'playback') setPlaybackError(description)
        else stateStore.update((s) => ({ ...s, connectionError: description }))
      },
    })
  }

  return {
    playerState: { subscribe: stateStore.subscribe },
    loopRegion: derived(stateStore, toLoopRegion),
    displayPositionMs: derived(stateStore, (s) => s.scrubPositionMs ?? s.positionMs),

    async init() {
      if (isInitialised) return
      if (!(await auth.getValidToken())) return
      isInitialised = true
      stateStore.update((s) => ({ ...s, connectionError: null }))

      try {
        await connectPlayer()
      } catch (error) {
        isInitialised = false
        stateStore.update((s) => ({
          ...s,
          connectionError: `Kunne ikke koble til Spotify: ${describe(error)}`,
        }))
      }
    },

    destroy() {
      loopEngine.dispose()
      cancelScrubTimer()
      lastScrubSeekMs = null
      pendingTrackId = null
      playerService.disconnect()
      isInitialised = false
      stateStore.set({ ...INITIAL_PLAYER_STATE })
    },

    async playTrack(track: SpotifyTrack) {
      setPlaybackError(null)
      const { deviceId } = get(stateStore)
      if (!deviceId) return setPlaybackError(NOT_READY_MESSAGE)

      pendingTrackId = track.id
      try {
        await apiService.startPlayback(deviceId, track.uri)
      } catch (error) {
        pendingTrackId = null
        return setPlaybackError(`Kunne ikke spille av låten: ${describe(error)}`)
      }

      loopEngine.stopLoop()
      stateStore.update((s) => ({ ...s, track, activeLoop: null }))
    },

    async togglePlay() {
      try {
        if (get(stateStore).isPlaying) await playerService.pause()
        else await playerService.resume()
      } catch (error) {
        setPlaybackError(`Kunne ikke endre avspilling: ${describe(error)}`)
      }
    },

    seek: seekSafely,

    scrubTo(positionMs) {
      stateStore.update((s) => ({ ...s, scrubPositionMs: positionMs }))
      if (scrubTimer !== null) return
      sendPendingScrubSeek()
      armScrubTimer()
    },

    async commitScrub(positionMs) {
      cancelScrubTimer()
      lastScrubSeekMs = null
      stateStore.update((s) => ({ ...s, scrubPositionMs: null, positionMs }))
      await seekSafely(positionMs)
    },

    async getCurrentPositionMs() {
      const snapshot = await playerService.getPlaybackSnapshot()
      if (!snapshot) return get(stateStore).positionMs
      updatePosition(snapshot.positionMs)
      return snapshot.positionMs
    },

    activateLoop,

    retimeActiveLoop(loop) {
      if (get(stateStore).activeLoop?.id !== loop.id) return
      stateStore.update((s) => ({
        ...s,
        activeLoop: { id: loop.id, startMs: loop.startMs, endMs: loop.endMs },
      }))
      loopEngine.updateLoop({ startMs: loop.startMs, endMs: loop.endMs })
    },

    deactivateLoop,

    deactivatePreviewLoop() {
      const { activeLoop } = get(stateStore)
      if (activeLoop && activeLoop.id === null) deactivateLoop()
    },

    toggleLoop(loop) {
      if (get(stateStore).activeLoop?.id === loop.id) deactivateLoop()
      else activateLoop(loop)
    },
  }
}
