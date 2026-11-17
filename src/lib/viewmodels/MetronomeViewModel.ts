import { readable, writable, type Readable } from 'svelte/store'
import { bpmFromTaps, clampBpm } from '$lib/models/metronome'
import type { PlayerState } from '$lib/models/player'
import type { IBpmService } from '$lib/services/BpmService'
import type { IBpmStorageService } from '$lib/services/BpmStorageService'
import type { IMetronomeService } from '$lib/services/MetronomeService'

export interface MetronomeState {
  bpm: number | null
  isRunning: boolean
  lookupStatus: 'idle' | 'loading' | 'found' | 'notFound' | 'error'
}

export interface MetronomeViewModel {
  metronomeState: Readable<MetronomeState>

  setBpm(bpm: number): void
  nudgeBpm(delta: number): void
  scaleBpm(factor: number): void
  tap(nowMs?: number): void
  toggle(): void
}

export interface MetronomePlayerSource {
  playerState: Readable<PlayerState>
}

const INITIAL_STATE: MetronomeState = { bpm: null, isRunning: false, lookupStatus: 'idle' }
const DEFAULT_BPM = 120
const TAP_RESET_AFTER_MS = 2000

export function createMetronomeViewModel(
  player: MetronomePlayerSource,
  bpmService: IBpmService,
  bpmStorage: IBpmStorageService,
  metronome: IMetronomeService,
): MetronomeViewModel {
  let currentTrackId: string | null = null
  let tapTimestampsMs: number[] = []
  let current = INITIAL_STATE

  const state = writable<MetronomeState>(INITIAL_STATE)

  function commit(next: MetronomeState) {
    current = next
    state.set(next)
  }

  function patch(changes: Partial<MetronomeState>) {
    commit({ ...current, ...changes })
  }

  // Loads only while something is subscribed, and cleans up afterwards.
  const lifecycle = readable<null>(null, () => {
    const unsubscribe = player.playerState.subscribe(({ track }) => {
      const trackId = track?.id ?? null
      if (trackId === currentTrackId) return
      currentTrackId = trackId
      tapTimestampsMs = []
      metronome.stop()

      if (!trackId) {
        commit(INITIAL_STATE)
        return
      }

      const storedBpm = bpmStorage.getBpm(trackId)
      if (storedBpm !== null) {
        commit({ bpm: storedBpm, isRunning: false, lookupStatus: 'found' })
        return
      }

      commit({ bpm: null, isRunning: false, lookupStatus: 'loading' })
      bpmService
        .getBpm(trackId)
        .then((tempo) => {
          if (currentTrackId !== trackId) return
          if (tempo === null) {
            patch({ lookupStatus: 'notFound' })
            return
          }
          // A tempo the user entered while the lookup was running wins
          if (current.bpm !== null) return
          const bpm = clampBpm(tempo)
          bpmStorage.saveBpm(trackId, bpm)
          patch({ bpm, lookupStatus: 'found' })
        })
        .catch(() => {
          if (currentTrackId !== trackId) return
          patch({ lookupStatus: 'error' })
        })
    })

    return () => {
      unsubscribe()
      metronome.stop()
      currentTrackId = null
      commit(INITIAL_STATE)
    }
  })

  function setBpm(value: number) {
    if (!currentTrackId || !Number.isFinite(value)) return
    const bpm = clampBpm(value)
    bpmStorage.saveBpm(currentTrackId, bpm)
    patch({ bpm, lookupStatus: 'found' })
    metronome.setBpm(bpm)
  }

  return {
    metronomeState: {
      subscribe(run, invalidate) {
        const unsubscribeLifecycle = lifecycle.subscribe(() => {})
        const unsubscribeState = state.subscribe(run, invalidate)
        return () => {
          unsubscribeState()
          unsubscribeLifecycle()
        }
      },
    },

    setBpm,

    nudgeBpm(delta) {
      setBpm((current.bpm ?? DEFAULT_BPM) + delta)
    },

    scaleBpm(factor) {
      if (current.bpm === null) return
      setBpm(current.bpm * factor)
    },

    tap(nowMs = Date.now()) {
      const lastTapMs = tapTimestampsMs.at(-1)
      if (lastTapMs !== undefined && nowMs - lastTapMs > TAP_RESET_AFTER_MS) tapTimestampsMs = []
      tapTimestampsMs.push(nowMs)
      const bpm = bpmFromTaps(tapTimestampsMs)
      if (bpm !== null) setBpm(bpm)
    },

    toggle() {
      if (current.isRunning) {
        metronome.stop()
        patch({ isRunning: false })
        return
      }
      if (current.bpm === null) return
      metronome.start(current.bpm)
      patch({ isRunning: true })
    },
  }
}
