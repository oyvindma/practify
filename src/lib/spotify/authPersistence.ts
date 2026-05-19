export const ACCESS_TOKEN_KEY = 'spotify_access_token'
export const REFRESH_TOKEN_KEY = 'spotify_refresh_token'
export const EXPIRES_AT_KEY = 'spotify_expires_at'
export const DISPLAY_NAME_KEY = 'spotify_display_name'
const DEBUG_SCOPES_KEY = 'spotify_debug_scopes'

export interface PersistedAuthState {
  accessToken: string | null
  refreshToken: string | null
  expiresAt: number | null
  displayName: string | null
}

export function loadPersistedAuth(): PersistedAuthState {
  return {
    accessToken: localStorage.getItem(ACCESS_TOKEN_KEY),
    refreshToken: localStorage.getItem(REFRESH_TOKEN_KEY),
    expiresAt: Number(localStorage.getItem(EXPIRES_AT_KEY)) || null,
    displayName: localStorage.getItem(DISPLAY_NAME_KEY),
  }
}

export function persistAuth(state: PersistedAuthState): void {
  if (state.accessToken) localStorage.setItem(ACCESS_TOKEN_KEY, state.accessToken)
  else localStorage.removeItem(ACCESS_TOKEN_KEY)

  if (state.refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, state.refreshToken)
  else localStorage.removeItem(REFRESH_TOKEN_KEY)

  if (state.expiresAt) localStorage.setItem(EXPIRES_AT_KEY, String(state.expiresAt))
  else localStorage.removeItem(EXPIRES_AT_KEY)

  if (state.displayName) localStorage.setItem(DISPLAY_NAME_KEY, state.displayName)
  else localStorage.removeItem(DISPLAY_NAME_KEY)
}

export function clearPersistedAuth(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  localStorage.removeItem(EXPIRES_AT_KEY)
  localStorage.removeItem(DISPLAY_NAME_KEY)
  localStorage.removeItem(DEBUG_SCOPES_KEY)
}

export function persistDebugScopes(scope: string): void {
  localStorage.setItem(DEBUG_SCOPES_KEY, scope)
}
