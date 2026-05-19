import { writable, get } from 'svelte/store'
import type { SpotifyTrack } from '$lib/spotify/api'
import { playTrack } from '$lib/spotify/api'
import { authStore } from '$lib/stores/authStore'
import { loadSpotifySDK } from '$lib/spotify/sdk'

export interface PlayerState {
  isReady: boolean
  deviceId: string | null
  track: SpotifyTrack | null
  positionMs: number
  durationMs: number
  isPlaying: boolean
  activeLoop: { id: string | null; startMs: number; endMs: number } | null
}

const INITIAL_STATE: PlayerState = {
  isReady: false,
  deviceId: null,
  track: null,
  positionMs: 0,
  durationMs: 0,
  isPlaying: false,
  activeLoop: null,
}

function createPlayerStore() {
  const { subscribe, set, update } = writable<PlayerState>(INITIAL_STATE)

  let player: Spotify.Player | null = null
  let loopTimeoutId: ReturnType<typeof setTimeout> | null = null
  let progressIntervalId: ReturnType<typeof setInterval> | null = null
  let loopRunning = false

  function startProgressPolling() {
    stopProgressPolling()
    progressIntervalId = setInterval(async () => {
      if (!player) return
      const state = await player.getCurrentState()
      if (!state || state.paused) return
      update((s) => ({ ...s, positionMs: state.position }))
    }, 500)
  }

  function stopProgressPolling() {
    if (progressIntervalId !== null) {
      clearInterval(progressIntervalId)
      progressIntervalId = null
    }
  }

  function startLoopPolling(startMs: number, endMs: number) {
    stopLoopPolling()
    loopRunning = true
    async function tick() {
      if (!loopRunning || !player) return
      const state = await player.getCurrentState()
      if (!loopRunning || !state) return
      update((s) => ({ ...s, positionMs: state.position }))
      if (state.position >= endMs) {
        player?.seek(startMs)
      }
      if (loopRunning) {
        loopTimeoutId = setTimeout(tick, 100)
      }
    }
    loopTimeoutId = setTimeout(tick, 0)
  }

  function stopLoopPolling() {
    loopRunning = false
    if (loopTimeoutId !== null) {
      clearTimeout(loopTimeoutId)
      loopTimeoutId = null
    }
  }

  return {
    subscribe,

    async init() {
      if (player) return  // already initialised

      const token = await authStore.getValidToken()
      if (!token) return

      await loadSpotifySDK()

      player = new window.Spotify.Player({
        name: 'Spotify Practice Tool',
        getOAuthToken: async (cb) => {
          const t = await authStore.getValidToken()
          if (t) cb(t)
        },
        volume: 0.8,
      })

      player.addListener('ready', ({ device_id }) => {
        update((s) => ({ ...s, isReady: true, deviceId: device_id }))
      })

      player.addListener('not_ready', () => {
        update((s) => ({ ...s, isReady: false, deviceId: null }))
      })

      player.addListener('player_state_changed', (state) => {
        if (!state) return
        update((s) => ({
          ...s,
          positionMs: state.position,
          durationMs: state.duration,
          isPlaying: !state.paused,
        }))
        if (!state.paused) {
          // Don't restart progress polling while loop polling is active
          if (!loopRunning) {
            startProgressPolling()
          }
        } else {
          stopProgressPolling()
        }
      })

      player.connect()
    },

    async play(trackUri: string) {
      const { deviceId } = get({ subscribe })
      if (!deviceId) return
      const token = await authStore.getValidToken()
      if (!token) return
      await playTrack(token, deviceId, trackUri)
    },

    async pause() {
      await player?.pause()
    },

    async resume() {
      await player?.resume()
    },

    async togglePlay() {
      const { isPlaying } = get(playerStore)
      if (isPlaying) {
        await player?.pause()
      } else {
        await player?.resume()
      }
    },

    async seek(positionMs: number) {
      await player?.seek(positionMs)
    },

    setTrack(track: SpotifyTrack) {
      update((s) => ({ ...s, track, activeLoop: null }))
      stopLoopPolling()
    },

    activateLoop(startMs: number, endMs: number, options?: { startFrom?: number; id?: string | null }) {
      update((s) => ({ ...s, activeLoop: { id: options?.id ?? null, startMs, endMs } }))
      stopProgressPolling()
      player?.seek(options?.startFrom ?? startMs)
      startLoopPolling(startMs, endMs)
    },

    deactivateLoop() {
      update((s) => ({ ...s, activeLoop: null }))
      stopLoopPolling()
      startProgressPolling()
    },

    destroy() {
      stopProgressPolling()
      stopLoopPolling()
      player?.disconnect()
      set(INITIAL_STATE)
    },
  }
}

export const playerStore = createPlayerStore()
