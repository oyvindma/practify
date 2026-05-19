import { describe, it, expect, beforeEach, vi } from 'vitest'
import { buildAuthUrl, exchangeCodeForToken, refreshAccessToken } from '../auth'

const CLIENT_ID = 'test-client-id'
const REDIRECT_URI = 'http://localhost:5173/callback'

vi.stubEnv('VITE_SPOTIFY_CLIENT_ID', CLIENT_ID)
vi.stubEnv('VITE_REDIRECT_URI', REDIRECT_URI)

describe('buildAuthUrl', () => {
  beforeEach(() => sessionStorage.clear())

  it('returns a valid Spotify authorize URL', async () => {
    const url = await buildAuthUrl()
    expect(url).toContain('https://accounts.spotify.com/authorize')
    expect(url).toContain(`client_id=${CLIENT_ID}`)
    expect(url).toContain('code_challenge_method=S256')
    expect(url).toContain('response_type=code')
    expect(url).toContain('state=')
  })

  it('stores code_verifier and state in sessionStorage', async () => {
    await buildAuthUrl()
    expect(sessionStorage.getItem('spotify_code_verifier')).toBeTruthy()
    expect(sessionStorage.getItem('spotify_auth_state')).toBeTruthy()
  })

  it('generates a unique verifier each call', async () => {
    await buildAuthUrl()
    const first = sessionStorage.getItem('spotify_code_verifier')
    await buildAuthUrl()
    const second = sessionStorage.getItem('spotify_code_verifier')
    expect(first).not.toBe(second)
  })
})

describe('exchangeCodeForToken', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  it('throws if no code verifier is in sessionStorage', async () => {
    await expect(exchangeCodeForToken('some-code')).rejects.toThrow(
      'No PKCE code verifier found',
    )
  })

  it('calls the token endpoint and returns token response', async () => {
    sessionStorage.setItem('spotify_code_verifier', 'test-verifier')

    const mockResponse = {
      access_token: 'at',
      token_type: 'Bearer',
      scope: 'streaming',
      expires_in: 3600,
      refresh_token: 'rt',
    }

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    const result = await exchangeCodeForToken('auth-code')
    expect(result.access_token).toBe('at')
    expect(sessionStorage.getItem('spotify_code_verifier')).toBeNull()
  })

  it('throws on non-ok response', async () => {
    sessionStorage.setItem('spotify_code_verifier', 'test-verifier')
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      text: async () => 'invalid_grant',
    } as Response)

    await expect(exchangeCodeForToken('bad-code')).rejects.toThrow('Token exchange failed')
  })
})

describe('refreshAccessToken', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls the token endpoint with refresh_token grant', async () => {
    const mockResponse = {
      access_token: 'new-at',
      token_type: 'Bearer',
      scope: 'streaming',
      expires_in: 3600,
    }

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    const result = await refreshAccessToken('my-refresh-token')
    expect(result.access_token).toBe('new-at')

    const fetchCall = vi.mocked(fetch).mock.calls[0]
    const body = fetchCall[1]?.body as URLSearchParams
    expect(body.get('grant_type')).toBe('refresh_token')
    expect(body.get('refresh_token')).toBe('my-refresh-token')
  })
})
