import {
  buildAuthUrl,
  exchangeCodeForToken,
  refreshAccessToken,
  validateAndConsumeState,
  type SpotifyTokenResponse,
} from '$lib/spotify/auth'
import {
  clearPersistedAuth,
  loadPersistedAuth,
  persistAuth,
  persistDebugScopes,
  type PersistedAuthState,
} from '$lib/spotify/authPersistence'

export interface ISpotifyAuthService {
  buildAuthUrl(): Promise<string>
  exchangeCodeForToken(code: string): Promise<SpotifyTokenResponse>
  refreshAccessToken(refreshToken: string): Promise<SpotifyTokenResponse>
  validateAndConsumeState(returnedState: string | null): boolean
  loadPersistedAuth(): PersistedAuthState
  persistAuth(state: PersistedAuthState): void
  clearPersistedAuth(): void
  persistDebugScopes(scope: string): void
}

export class SpotifyAuthService implements ISpotifyAuthService {
  buildAuthUrl = buildAuthUrl
  exchangeCodeForToken = exchangeCodeForToken
  refreshAccessToken = refreshAccessToken
  validateAndConsumeState = validateAndConsumeState
  loadPersistedAuth = loadPersistedAuth
  persistAuth = persistAuth
  clearPersistedAuth = clearPersistedAuth
  persistDebugScopes = persistDebugScopes
}
