import { readable, writable, type Readable } from 'svelte/store'
import {
  MAX_SYNC_TAPS,
  bpmFromTaps,
  clampBpm,
  estimateBeatOffsetMs,
  msUntilNextBeat,
  shiftBeatOffsetMs,
} from '$lib/models/metronome'
import { INITIAL_PLAYER_STATE, type ActiveLoop, type PlayerState } from '$lib/models/player'
import type { SpotifyTrack } from '$lib/models/spotify'
import type { LoopRange } from '$lib/playback/LoopEngine'
import type { IPracticeClock } from '$lib/playback/PracticeClock'
import type { IBpmService } from '$lib/services/BpmService'
import type { IBpmStorageService } from '$lib/services/BpmStorageService'
import type { IMetronomeService } from '$lib/services/MetronomeService'

export type PracticeMode = 'withSong' | 'silent'

export interface MetronomeState {
  bpm: number | null
  isRunning: boolean
  lookupStatus: 'idle' | 'loading' | 'found' | 'notFound' | 'error'
  mode: PracticeMode
  // Where the song's beats fall (ms into the song, modulo one beat); null until synced
  beatOffsetMs: number | null
  isSyncing: boolean
  syncTapCount: number
}

export interface MetronomeViewModel {
  metronomeState: Readable<MetronomeState>
  // Where the lyrics should be while practising without the song; null when the song drives them
  practicePositionMs: Readable<number | null>

  setBpm(bpm: number): void
  nudgeBpm(delta: number): void
  scaleBpm(factor: number): void
  tap(nowMs?: number): void
  toggle(): void
  toggleSync(): void
  tapBeat(): void
  nudgeBeatOffset(deltaMs: number): void
  resetSync(): void
  setMode(mode: PracticeMode): void
  playFromLyricLine(startMs: number): void
}

export interface MetronomePlayerSource {
  playerState: Readable<PlayerState>
  togglePlay(): Promise<void>
  seek(positionMs: number): Promise<void>
  getCurrentPositionMs(): Promise<number>
}

interface PositionSample {
  positionMs: number
  atMs: number
}

const INITIAL_STATE: MetronomeState = {
  bpm: null,
  isRunning: false,
  lookupStatus: 'idle',
  mode: 'withSong',
  beatOffsetMs: null,
  isSyncing: false,
  syncTapCount: 0,
}
const DEFAULT_BPM = 120
const TAP_RESET_AFTER_MS = 2000
const POSITION_JUMP_TOLERANCE_MS = 250

function loopKey(loop: ActiveLoop | null): string | null {
  return loop ? `${loop.id}:${loop.startMs}:${loop.endMs}` : null
}

function toRange(loop: ActiveLoop | null): LoopRange | null {
  return loop ? { startMs: loop.startMs, endMs: loop.endMs } : null
}

export function createMetronomeViewModel(
  player: MetronomePlayerSource,
  bpmService: IBpmService,
  bpmStorage: IBpmStorageService,
  metronome: IMetronomeService,
  practiceClock: IPracticeClock,
): MetronomeViewModel {
  let currentTrackId: string | null = null
  let tapTimestampsMs: number[] = []
  let current = INITIAL_STATE
  let playerSnapshot: PlayerState = INITIAL_PLAYER_STATE
  let previousLoopKey: string | null = null
  let pickedLineStartMs: number | null = null
  let lastPositionSample: PositionSample | null = null
  let syncTapPositionsMs: number[] = []

  const state = writable<MetronomeState>(INITIAL_STATE)
  const practicePosition = writable<number | null>(null)

  function commit(next: MetronomeState) {
    current = next
    state.set(next)
  }

  function patch(changes: Partial<MetronomeState>) {
    commit({ ...current, ...changes })
  }

  function silentStartMs(): number {
    return playerSnapshot.activeLoop?.startMs ?? pickedLineStartMs ?? 0
  }

  function showSilentStartPosition() {
    practicePosition.set(silentStartMs())
  }

  // Without a synced beat grid the clicks simply start together with the position
  function startClicksAt(positionMs: number) {
    if (current.bpm === null) return
    const delayMs =
      current.beatOffsetMs === null
        ? 0
        : msUntilNextBeat(positionMs, current.beatOffsetMs, current.bpm)
    metronome.start(current.bpm, delayMs)
  }

  function startSilentSession(startMs: number = silentStartMs()) {
    if (current.bpm === null) return
    practiceClock.start({
      startMs,
      loop: toRange(playerSnapshot.activeLoop),
      trackEndMs: playerSnapshot.durationMs,
      onPosition: (positionMs) => practicePosition.set(positionMs),
      // Loops rarely span a whole number of beats, so the click grid restarts on every lap
      onWrap: () => startClicksAt(playerSnapshot.activeLoop?.startMs ?? 0),
      onEnd: stopSession,
    })
    startClicksAt(startMs)
  }

  async function alignClicksToSong() {
    const isWaitingForSong = current.mode !== 'withSong' || !current.isRunning
    if (isWaitingForSong || current.bpm === null) return
    if (!playerSnapshot.isPlaying) {
      metronome.stop()
      return
    }
    const bpm = current.bpm
    const positionMs = await player.getCurrentPositionMs()
    const stillApplies =
      current.mode === 'withSong' && current.isRunning && playerSnapshot.isPlaying
    if (!stillApplies) return
    const gridAnchorMs = current.beatOffsetMs ?? playerSnapshot.activeLoop?.startMs ?? 0
    metronome.start(bpm, msUntilNextBeat(positionMs, gridAnchorMs, bpm))
  }

  async function seekAndPlay(positionMs: number) {
    await player.seek(positionMs)
    if (!playerSnapshot.isPlaying) await player.togglePlay()
  }

  function stopSession() {
    practiceClock.stop()
    metronome.stop()
    if (current.isRunning) patch({ isRunning: false })
    if (current.mode === 'silent') showSilentStartPosition()
  }

  function cancelSync() {
    syncTapPositionsMs = []
    if (current.isSyncing || current.syncTapCount > 0) patch({ isSyncing: false, syncTapCount: 0 })
  }

  function applyBeatOffset(offsetMs: number | null) {
    if (!currentTrackId) return
    if (offsetMs === null) bpmStorage.clearBeatOffsetMs(currentTrackId)
    else bpmStorage.saveBeatOffsetMs(currentTrackId, offsetMs)
    patch({ beatOffsetMs: offsetMs })
    if (current.isRunning && current.mode === 'withSong') void alignClicksToSong()
  }

  async function recordSyncTap() {
    if (!current.isSyncing || current.bpm === null) return
    const positionMs = await player.getCurrentPositionMs()
    if (!current.isSyncing || current.bpm === null) return
    syncTapPositionsMs.push(positionMs)
    patch({ syncTapCount: syncTapPositionsMs.length })
    const offsetMs = estimateBeatOffsetMs(syncTapPositionsMs, current.bpm)
    if (offsetMs !== null) applyBeatOffset(offsetMs)
    if (syncTapPositionsMs.length >= MAX_SYNC_TAPS) cancelSync()
  }

  function setMode(mode: PracticeMode) {
    if (mode === current.mode) return
    cancelSync()
    stopSession()
    if (mode === 'silent') {
      if (playerSnapshot.isPlaying) void player.togglePlay()
      patch({ mode })
      showSilentStartPosition()
    } else {
      patch({ mode })
      practicePosition.set(null)
    }
  }

  function setBpm(value: number) {
    if (!currentTrackId || !Number.isFinite(value)) return
    const bpm = clampBpm(value)
    bpmStorage.saveBpm(currentTrackId, bpm)
    patch({ bpm, lookupStatus: 'found' })
    if (!current.isRunning) return
    if (current.mode === 'withSong') void alignClicksToSong()
    else metronome.setBpm(bpm)
  }

  function loadBpmForTrack(track: SpotifyTrack) {
    const trackId = track.id
    const storedBpm = bpmStorage.getBpm(trackId)
    if (storedBpm !== null) {
      commit({ ...current, bpm: storedBpm, lookupStatus: 'found' })
      return
    }

    commit({ ...current, bpm: null, lookupStatus: 'loading' })
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
  }

  function handleTrackChange(track: SpotifyTrack | null) {
    currentTrackId = track?.id ?? null
    tapTimestampsMs = []
    pickedLineStartMs = null
    lastPositionSample = null
    stopSession()
    syncTapPositionsMs = []
    if (!track) {
      commit({ ...INITIAL_STATE, mode: current.mode })
      return
    }
    commit({
      ...current,
      beatOffsetMs: bpmStorage.getBeatOffsetMs(track.id),
      isSyncing: false,
      syncTapCount: 0,
    })
    loadBpmForTrack(track)
    if (current.mode === 'silent') showSilentStartPosition()
  }

  function handleLoopChange(loop: ActiveLoop | null) {
    const key = loopKey(loop)
    if (key === previousLoopKey) return
    previousLoopKey = key

    if (current.mode === 'withSong') {
      void alignClicksToSong()
    } else if (!current.isRunning) {
      showSilentStartPosition()
    } else if (loop) {
      startSilentSession(loop.startMs)
    } else {
      practiceClock.setLoop(null)
    }
  }

  function handlePlayingChange(wasPlaying: boolean, isPlaying: boolean) {
    if (wasPlaying === isPlaying) return
    lastPositionSample = null
    if (!isPlaying) cancelSync()
    if (current.mode === 'silent') {
      // Starting the song yourself means you want it back
      if (isPlaying) setMode('withSong')
      return
    }
    if (current.isRunning) void alignClicksToSong()
  }

  // Seeks and loop laps move the song position; the beat grid has to follow
  function handlePositionSample(positionMs: number, isPlaying: boolean) {
    const previous = lastPositionSample
    if (previous && previous.positionMs === positionMs) return
    const sample = { positionMs, atMs: Date.now() }
    lastPositionSample = sample
    if (!previous || !isPlaying || current.mode !== 'withSong' || !current.isRunning) return
    const expectedMs = previous.positionMs + (sample.atMs - previous.atMs)
    if (Math.abs(positionMs - expectedMs) > POSITION_JUMP_TOLERANCE_MS) void alignClicksToSong()
  }

  // Loads only while something is subscribed, and cleans up afterwards.
  const lifecycle = readable<null>(null, () => {
    const unsubscribe = player.playerState.subscribe((next) => {
      const previous = playerSnapshot
      playerSnapshot = next
      if ((next.track?.id ?? null) !== currentTrackId) handleTrackChange(next.track)
      handleLoopChange(next.activeLoop)
      handlePlayingChange(previous.isPlaying, next.isPlaying)
      handlePositionSample(next.positionMs, next.isPlaying)
    })

    return () => {
      unsubscribe()
      practiceClock.stop()
      metronome.stop()
      currentTrackId = null
      previousLoopKey = null
      playerSnapshot = INITIAL_PLAYER_STATE
      commit(INITIAL_STATE)
      practicePosition.set(null)
    }
  })

  function withLifecycle<T>(store: Readable<T>): Readable<T> {
    return {
      subscribe(run, invalidate) {
        const unsubscribeLifecycle = lifecycle.subscribe(() => {})
        const unsubscribeStore = store.subscribe(run, invalidate)
        return () => {
          unsubscribeStore()
          unsubscribeLifecycle()
        }
      },
    }
  }

  return {
    metronomeState: withLifecycle(state),
    practicePositionMs: withLifecycle(practicePosition),

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
        stopSession()
        return
      }
      if (current.bpm === null) return
      patch({ isRunning: true })
      if (current.mode === 'silent') startSilentSession()
      else void alignClicksToSong()
    },

    toggleSync() {
      if (current.isSyncing) {
        cancelSync()
        return
      }
      const canSync =
        current.mode === 'withSong' && playerSnapshot.isPlaying && current.bpm !== null
      if (!canSync) return
      syncTapPositionsMs = []
      patch({ isSyncing: true, syncTapCount: 0 })
    },

    tapBeat() {
      void recordSyncTap()
    },

    nudgeBeatOffset(deltaMs) {
      if (current.beatOffsetMs === null || current.bpm === null) return
      applyBeatOffset(shiftBeatOffsetMs(current.beatOffsetMs, deltaMs, current.bpm))
    },

    resetSync() {
      cancelSync()
      applyBeatOffset(null)
    },

    setMode,

    playFromLyricLine(startMs) {
      // An active loop decides where practice starts
      if (playerSnapshot.activeLoop) return
      if (current.mode === 'withSong') {
        void seekAndPlay(startMs)
        return
      }
      pickedLineStartMs = startMs
      if (current.bpm === null) {
        showSilentStartPosition()
        return
      }
      patch({ isRunning: true })
      startSilentSession(startMs)
    },
  }
}
