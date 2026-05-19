import { writable, derived, get } from 'svelte/store'
import { refreshAccessToken, type SpotifyTokenResponse } from '$lib/spotify/auth'
import {
  loadPersistedAuth,
  persistAuth,
  clearPersistedAuth,
  persistDebugScopes,
  type PersistedAuthState,
} from '$lib/spotify/authPersistence'

function createAuthStore() {
  const { subscribe, set, update } = writable<PersistedAuthState>(loadPersistedAuth())

  return {
    subscribe,

    setTokens(response: SpotifyTokenResponse) {
      const expiresAt = Date.now() + response.expires_in * 1000
      console.log('[auth] Granted scopes:', response.scope)
      persistDebugScopes(response.scope)
      update((state) => {
        const next: PersistedAuthState = {
          accessToken: response.access_token,
          refreshToken: response.refresh_token ?? state.refreshToken,
          expiresAt,
          displayName: state.displayName,
        }
        persistAuth(next)
        return next
      })
    },

    setDisplayName(name: string) {
      update((state) => {
        const next = { ...state, displayName: name }
        persistAuth(next)
        return next
      })
    },

    logout() {
      clearPersistedAuth()
      set({ accessToken: null, refreshToken: null, expiresAt: null, displayName: null })
    },

    async getValidToken(): Promise<string | null> {
      const state = get({ subscribe })
      if (!state.accessToken) return null

      const isExpiredSoon = state.expiresAt !== null && Date.now() > state.expiresAt - 60_000
      if (!isExpiredSoon) return state.accessToken

      if (!state.refreshToken) {
        authStore.logout()
        return null
      }

      try {
        const refreshed = await refreshAccessToken(state.refreshToken)
        authStore.setTokens(refreshed)
        return refreshed.access_token
      } catch {
        authStore.logout()
        return null
      }
    },
  }
}

export const authStore = createAuthStore()
export const isAuthenticated = derived(authStore, ($auth) => !!$auth.accessToken)
