import { describe, it, expect, beforeEach, vi, type MockInstance } from 'vitest'
import { get } from 'svelte/store'

vi.mock('$lib/spotify/auth', () => ({
  refreshAccessToken: vi.fn(),
}))

import { refreshAccessToken } from '$lib/spotify/auth'
import { authStore, isAuthenticated } from '../authStore'

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

beforeEach(() => {
  authStore.logout()
  localStorage.clear()
  vi.clearAllMocks()
})

describe('setTokens', () => {
  it('stores access token in state', () => {
    authStore.setTokens(mockToken)
    expect(get(authStore).accessToken).toBe('test-access-token')
  })

  it('persists access token to localStorage', () => {
    authStore.setTokens(mockToken)
    expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBe('test-access-token')
  })

  it('calculates expiresAt correctly', () => {
    const now = 1_000_000_000
    vi.spyOn(Date, 'now').mockReturnValue(now)
    authStore.setTokens(mockToken)
    expect(get(authStore).expiresAt).toBe(now + 3600 * 1000)
  })

  it('keeps existing refreshToken if new response has none', () => {
    authStore.setTokens(mockToken)
    authStore.setTokens({ ...mockToken, refresh_token: undefined })
    expect(get(authStore).refreshToken).toBe('test-refresh-token')
  })
})

describe('setDisplayName', () => {
  it('updates displayName in state', () => {
    authStore.setDisplayName('Alice')
    expect(get(authStore).displayName).toBe('Alice')
  })

  it('persists displayName to localStorage', () => {
    authStore.setDisplayName('Alice')
    expect(localStorage.getItem(DISPLAY_NAME_KEY)).toBe('Alice')
  })
})

describe('logout', () => {
  it('clears all state', () => {
    authStore.setTokens(mockToken)
    authStore.logout()
    const state = get(authStore)
    expect(state.accessToken).toBeNull()
    expect(state.refreshToken).toBeNull()
    expect(state.expiresAt).toBeNull()
    expect(state.displayName).toBeNull()
  })

  it('removes all localStorage keys', () => {
    authStore.setTokens(mockToken)
    authStore.setDisplayName('Bob')
    authStore.logout()
    expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull()
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull()
    expect(localStorage.getItem(EXPIRES_AT_KEY)).toBeNull()
    expect(localStorage.getItem(DISPLAY_NAME_KEY)).toBeNull()
  })
})

describe('isAuthenticated', () => {
  it('is false when no token', () => {
    expect(get(isAuthenticated)).toBe(false)
  })

  it('is true after setTokens', () => {
    authStore.setTokens(mockToken)
    expect(get(isAuthenticated)).toBe(true)
  })
})

describe('getValidToken', () => {
  it('returns token when not expired', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000_000)
    authStore.setTokens(mockToken) // expiresAt = 1_000_000_000 + 3_600_000
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000_000 + 1000) // well before expiry
    const token = await authStore.getValidToken()
    expect(token).toBe('test-access-token')
  })

  it('calls refreshAccessToken when token is expired and refresh token exists', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000_000)
    authStore.setTokens(mockToken)
    // Move time past expiry threshold (expiresAt - 60_000)
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000_000 + 3_600_000)

    const refreshed = { ...mockToken, access_token: 'new-access-token' }
    vi.mocked(refreshAccessToken).mockResolvedValueOnce(refreshed)

    const token = await authStore.getValidToken()
    expect(refreshAccessToken).toHaveBeenCalledWith('test-refresh-token')
    expect(token).toBe('new-access-token')
  })

  it('calls logout and returns null when refresh fails', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000_000)
    authStore.setTokens(mockToken)
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000_000 + 3_600_000)

    vi.mocked(refreshAccessToken).mockRejectedValueOnce(new Error('refresh failed'))

    const token = await authStore.getValidToken()
    expect(token).toBeNull()
    expect(get(authStore).accessToken).toBeNull()
  })

  it('calls logout and returns null when no refresh token', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000_000)
    authStore.setTokens({ ...mockToken, refresh_token: undefined })
    // Force no refresh token in state
    authStore.setTokens({ ...mockToken, access_token: 'tok', refresh_token: undefined })
    // Manually drain refresh token: logout and set tokens without refresh token
    authStore.logout()
    // Set only access token (no refresh)
    authStore.setTokens({ ...mockToken, refresh_token: undefined })
    // Now wipe any leftover refresh token by calling logout first then setTokens
    // The store keeps existing refreshToken if new one is absent — so we need a clean logout first
    authStore.logout()
    localStorage.clear()
    authStore.setTokens({ ...mockToken, refresh_token: undefined })
    // At this point refreshToken should be null since we started from logout
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000_000 + 3_600_000)

    const token = await authStore.getValidToken()
    expect(token).toBeNull()
    expect(get(authStore).accessToken).toBeNull()
  })
})
