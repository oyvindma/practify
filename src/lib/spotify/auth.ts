const VERIFIER_KEY = 'spotify_code_verifier'
export const STATE_KEY = 'spotify_auth_state'

const SCOPES = [
  'user-read-private',
  'user-read-email',
  'playlist-read-private',
  'playlist-read-collaborative',
  'streaming',
  'user-read-playback-state',
  'user-modify-playback-state',
].join(' ')

function generateRandomString(length: number): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const values = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(values)
    .map((v) => possible[v % possible.length])
    .join('')
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder()
  const data = encoder.encode(plain)
  return crypto.subtle.digest('SHA-256', data)
}

function base64UrlEncode(input: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(input)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export async function buildAuthUrl(): Promise<string> {
  const verifier = generateRandomString(128)
  const hashed = await sha256(verifier)
  const challenge = base64UrlEncode(hashed)
  const state = generateRandomString(16)

  sessionStorage.setItem(VERIFIER_KEY, verifier)
  sessionStorage.setItem(STATE_KEY, state)

  const params = new URLSearchParams({
    client_id: import.meta.env.VITE_SPOTIFY_CLIENT_ID,
    response_type: 'code',
    redirect_uri: import.meta.env.VITE_REDIRECT_URI,
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    state,
    show_dialog: 'true',
  })

  return `https://accounts.spotify.com/authorize?${params.toString()}`
}

export async function exchangeCodeForToken(
  code: string,
): Promise<SpotifyTokenResponse> {
  const verifier = sessionStorage.getItem(VERIFIER_KEY)
  if (!verifier) throw new Error('No PKCE code verifier found in session storage')

  const body = new URLSearchParams({
    client_id: import.meta.env.VITE_SPOTIFY_CLIENT_ID,
    grant_type: 'authorization_code',
    code,
    redirect_uri: import.meta.env.VITE_REDIRECT_URI,
    code_verifier: verifier,
  })

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Token exchange failed: ${error}`)
  }

  sessionStorage.removeItem(VERIFIER_KEY)
  return response.json() as Promise<SpotifyTokenResponse>
}

/**
 * Validates the OAuth state parameter and removes it from sessionStorage.
 * Returns true when the returned state matches what was stored; false otherwise
 * (including when no state was stored, which would indicate a CSRF risk).
 */
export function validateAndConsumeState(returnedState: string | null): boolean {
  const expected = sessionStorage.getItem(STATE_KEY)
  sessionStorage.removeItem(STATE_KEY)
  return !!expected && returnedState === expected
}

export async function refreshAccessToken(refreshToken: string): Promise<SpotifyTokenResponse> {
  const body = new URLSearchParams({
    client_id: import.meta.env.VITE_SPOTIFY_CLIENT_ID,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Token refresh failed: ${error}`)
  }

  return response.json() as Promise<SpotifyTokenResponse>
}

export interface SpotifyTokenResponse {
  access_token: string
  token_type: string
  scope: string
  expires_in: number
  refresh_token?: string
}
