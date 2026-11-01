import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { get } from 'svelte/store'
import { SpotifyAuthService } from '$lib/services/SpotifyAuthService'
import { createAuthViewModel, type AuthViewModel } from '../AuthViewModel'

const ACCESS_TOKEN_KEY = 'spotify_access_token'
const REFRESH_TOKEN_KEY = 'spotify_refresh_token'
const EXPIRES_AT_KEY = 'spotify_expires_at'
const DISPLAY_NAME_KEY = 'spotify_display_name'

const mockToken = {
  access_token: 'test-access-token',
  refresh_token: 'test-refresh-token',
  expires_in: 3600,
  token_type: 'Bearer',
  scope: 'streaming',
}

let authService: SpotifyAuthService
let navigation: { redirectTo: AnyMock; replaceWith: AnyMock }
let authViewModel: AuthViewModel

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
  authService = new SpotifyAuthService()
  authService.refreshAccessToken = vi.fn()
  navigation = { redirectTo: vi.fn(), replaceWith: vi.fn() }
  authViewModel = createAuthViewModel(authService, navigation)
})

describe('setTokens', () => {
  it('stores access token in state', () => {
    authViewModel.storeTokens(mockToken)
    expect(get(authViewModel.authState).accessToken).toBe('test-access-token')
  })

  it('persists access token to localStorage', () => {
    authViewModel.storeTokens(mockToken)
    expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBe('test-access-token')
  })

  it('calculates expiresAt correctly', () => {
    const now = 1_000_000_000
    vi.spyOn(Date, 'now').mockReturnValue(now)
    authViewModel.storeTokens(mockToken)
    expect(get(authViewModel.authState).expiresAt).toBe(now + 3600 * 1000)
  })

  it('keeps existing refreshToken if new response has none', () => {
    authViewModel.storeTokens(mockToken)
    authViewModel.storeTokens({ ...mockToken, refresh_token: undefined })
    expect(get(authViewModel.authState).refreshToken).toBe('test-refresh-token')
  })
})

describe('setDisplayName', () => {
  it('updates displayName in state', () => {
    authViewModel.storeDisplayName('Alice')
    expect(get(authViewModel.authState).displayName).toBe('Alice')
  })

  it('persists displayName to localStorage', () => {
    authViewModel.storeDisplayName('Alice')
    expect(localStorage.getItem(DISPLAY_NAME_KEY)).toBe('Alice')
  })
})

describe('logout', () => {
  it('clears all state', () => {
    authViewModel.storeTokens(mockToken)
    authViewModel.logout()
    const state = get(authViewModel.authState)
    expect(state.accessToken).toBeNull()
    expect(state.refreshToken).toBeNull()
    expect(state.expiresAt).toBeNull()
    expect(state.displayName).toBeNull()
  })

  it('removes all localStorage keys', () => {
    authViewModel.storeTokens(mockToken)
    authViewModel.storeDisplayName('Bob')
    authViewModel.logout()
    expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull()
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull()
    expect(localStorage.getItem(EXPIRES_AT_KEY)).toBeNull()
    expect(localStorage.getItem(DISPLAY_NAME_KEY)).toBeNull()
  })
})

describe('isAuthenticated', () => {
  it('is false when no token', () => {
    expect(get(authViewModel.isAuthenticated)).toBe(false)
  })

  it('is true after setTokens', () => {
    authViewModel.storeTokens(mockToken)
    expect(get(authViewModel.isAuthenticated)).toBe(true)
  })
})

describe('getValidToken', () => {
  it('returns token when not expired', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000_000)
    authViewModel.storeTokens(mockToken) // expiresAt = 1_000_000_000 + 3_600_000
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000_000 + 1000) // well before expiry
    const token = await authViewModel.getValidToken()
    expect(token).toBe('test-access-token')
  })

  it('refreshes the token when token is expired and refresh token exists', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000_000)
    authViewModel.storeTokens(mockToken)
    // Move time past expiry threshold (expiresAt - 60_000)
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000_000 + 3_600_000)

    const refreshed = { ...mockToken, access_token: 'new-access-token' }
    vi.mocked(authService.refreshAccessToken).mockResolvedValueOnce(refreshed)

    const token = await authViewModel.getValidToken()
    expect(authService.refreshAccessToken).toHaveBeenCalledWith('test-refresh-token')
    expect(token).toBe('new-access-token')
  })

  it('calls logout and returns null when refresh fails', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000_000)
    authViewModel.storeTokens(mockToken)
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000_000 + 3_600_000)

    vi.mocked(authService.refreshAccessToken).mockRejectedValueOnce(new Error('refresh failed'))

    const token = await authViewModel.getValidToken()
    expect(token).toBeNull()
    expect(get(authViewModel.authState).accessToken).toBeNull()
  })

  it('calls logout and returns null when there is no refresh token', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000_000)
    authViewModel.storeTokens({ ...mockToken, refresh_token: undefined })
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000_000 + 3_600_000)

    const token = await authViewModel.getValidToken()
    expect(token).toBeNull()
    expect(get(authViewModel.authState).accessToken).toBeNull()
    expect(authService.refreshAccessToken).not.toHaveBeenCalled()
  })

  it('returns null without refreshing when logged out', async () => {
    expect(await authViewModel.getValidToken()).toBeNull()
  })
})

describe('login', () => {
  it('redirects the browser to the Spotify authorize url', async () => {
    authService.buildAuthUrl = vi
      .fn()
      .mockResolvedValue('https://accounts.spotify.com/authorize?x=1')
    await authViewModel.login()
    expect(navigation.redirectTo).toHaveBeenCalledWith('https://accounts.spotify.com/authorize?x=1')
  })
})

describe('initial state', () => {
  it('restores persisted tokens', () => {
    authViewModel.storeTokens(mockToken)
    const restored = createAuthViewModel(new SpotifyAuthService(), navigation)
    expect(get(restored.authState).accessToken).toBe('test-access-token')
    expect(get(restored.isAuthenticated)).toBe(true)
  })
})

type AnyMock = Mock<(...args: never[]) => unknown>
