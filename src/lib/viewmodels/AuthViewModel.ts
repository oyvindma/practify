import { writable, derived, get, type Readable } from 'svelte/store'
import type { SpotifyTokenResponse } from '$lib/spotify/auth'
import type { PersistedAuthState } from '$lib/spotify/authPersistence'
import type { ISpotifyAuthService } from '$lib/services/SpotifyAuthService'
import type { INavigationService } from '$lib/services/NavigationService'

const TOKEN_EXPIRY_MARGIN_MS = 60_000

export interface AuthViewModel {
  authState: Readable<PersistedAuthState>
  isAuthenticated: Readable<boolean>

  login(): Promise<void>
  logout(): void
  storeTokens(response: SpotifyTokenResponse): void
  storeDisplayName(name: string): void
  getValidToken(): Promise<string | null>
}

export function createAuthViewModel(
  authService: ISpotifyAuthService,
  navigation: INavigationService,
): AuthViewModel {
  const authStore = writable<PersistedAuthState>(authService.loadPersistedAuth())

  function replaceState(next: PersistedAuthState) {
    authService.persistAuth(next)
    authStore.set(next)
  }

  function logout() {
    authService.clearPersistedAuth()
    authStore.set({ accessToken: null, refreshToken: null, expiresAt: null, displayName: null })
  }

  function storeTokens(response: SpotifyTokenResponse) {
    const current = get(authStore)
    authService.persistDebugScopes(response.scope)
    replaceState({
      accessToken: response.access_token,
      refreshToken: response.refresh_token ?? current.refreshToken,
      expiresAt: Date.now() + response.expires_in * 1000,
      displayName: current.displayName,
    })
  }

  async function getValidToken(): Promise<string | null> {
    const current = get(authStore)
    if (!current.accessToken) return null

    const isExpiredSoon =
      current.expiresAt !== null && Date.now() > current.expiresAt - TOKEN_EXPIRY_MARGIN_MS
    if (!isExpiredSoon) return current.accessToken

    if (!current.refreshToken) {
      logout()
      return null
    }

    try {
      const refreshed = await authService.refreshAccessToken(current.refreshToken)
      storeTokens(refreshed)
      return refreshed.access_token
    } catch {
      logout()
      return null
    }
  }

  return {
    authState: { subscribe: authStore.subscribe },
    isAuthenticated: derived(authStore, (state) => !!state.accessToken),

    async login() {
      navigation.redirectTo(await authService.buildAuthUrl())
    },

    logout,
    storeTokens,

    storeDisplayName(name: string) {
      replaceState({ ...get(authStore), displayName: name })
    },

    getValidToken,
  }
}
