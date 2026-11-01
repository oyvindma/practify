import type { SpotifyTrack } from '$lib/models/spotify'

export interface ActiveLoop {
  id: string | null
  startMs: number
  endMs: number
}

export interface PlayerState {
  isReady: boolean
  deviceId: string | null
  track: SpotifyTrack | null
  positionMs: number
  durationMs: number
  isPlaying: boolean
  activeLoop: ActiveLoop | null
  scrubPositionMs: number | null
  connectionError: string | null
  playbackError: string | null
}

export const INITIAL_PLAYER_STATE: PlayerState = {
  isReady: false,
  deviceId: null,
  track: null,
  positionMs: 0,
  durationMs: 0,
  isPlaying: false,
  activeLoop: null,
  scrubPositionMs: null,
  connectionError: null,
  playbackError: null,
}

export interface LoopRegion {
  startPercent: number
  widthPercent: number
}

export function toLoopRegion(state: PlayerState): LoopRegion | null {
  if (!state.activeLoop || state.durationMs <= 0) return null
  const startPercent = (state.activeLoop.startMs / state.durationMs) * 100
  const endPercent = (state.activeLoop.endMs / state.durationMs) * 100
  return { startPercent, widthPercent: endPercent - startPercent }
}
