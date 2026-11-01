import { describe, it, expect, beforeEach, vi } from 'vitest'
import { get } from 'svelte/store'
import { createCallbackViewModel, isOAuthCallback } from '../CallbackViewModel'

const tokens = {
  access_token: 'a',
  token_type: 'Bearer',
  scope: 's',
  expires_in: 3600,
  refresh_token: 'r',
}

describe('isOAuthCallback', () => {
  it('is true with a code or an error', () => {
    expect(isOAuthCallback('?code=abc&state=x')).toBe(true)
    expect(isOAuthCallback('?error=access_denied')).toBe(true)
  })

  it('is false otherwise', () => {
    expect(isOAuthCallback('')).toBe(false)
    expect(isOAuthCallback('?foo=bar')).toBe(false)
  })
})

describe('CallbackViewModel', () => {
  const authService = {
    validateAndConsumeState: vi.fn(),
    exchangeCodeForToken: vi.fn(),
  }
  const apiService = { getCurrentUser: vi.fn() }
  const auth = { storeTokens: vi.fn(), storeDisplayName: vi.fn() }
  const navigation = { redirectTo: vi.fn(), replaceWith: vi.fn() }

  function create(search: string) {
    return createCallbackViewModel(
      search,
      '/home/',
      authService as never,
      apiService as never,
      auth,
      navigation,
    )
  }

  beforeEach(() => {
    vi.clearAllMocks()
    authService.validateAndConsumeState.mockReturnValue(true)
    authService.exchangeCodeForToken.mockResolvedValue(tokens)
    apiService.getCurrentUser.mockResolvedValue({ id: 'u', display_name: 'Alice' })
  })

  it('reports an error returned by Spotify', async () => {
    const vm = create('?error=access_denied')
    await vm.completeLogin()
    expect(get(vm.callbackState).error).toBe('Spotify avviste innloggingen: access_denied')
  })

  it('reports a missing code', async () => {
    const vm = create('?state=x')
    await vm.completeLogin()
    expect(get(vm.callbackState).error).toBe('Ingen autorisasjonskode mottatt')
  })

  it('rejects an invalid state without exchanging the code', async () => {
    authService.validateAndConsumeState.mockReturnValue(false)
    const vm = create('?code=abc&state=bad')
    await vm.completeLogin()
    expect(get(vm.callbackState).error).toContain('Ugyldig state-parameter')
    expect(authService.exchangeCodeForToken).not.toHaveBeenCalled()
  })

  it('stores tokens and display name, then returns home', async () => {
    const vm = create('?code=abc&state=good')
    await vm.completeLogin()
    expect(authService.validateAndConsumeState).toHaveBeenCalledWith('good')
    expect(authService.exchangeCodeForToken).toHaveBeenCalledWith('abc')
    expect(auth.storeTokens).toHaveBeenCalledWith(tokens)
    expect(auth.storeDisplayName).toHaveBeenCalledWith('Alice')
    expect(navigation.replaceWith).toHaveBeenCalledWith('/home/')
    expect(get(vm.callbackState).error).toBeNull()
  })

  it('reports exchange failures and stays on the page', async () => {
    authService.exchangeCodeForToken.mockRejectedValue(new Error('exchange failed'))
    const vm = create('?code=abc&state=good')
    await vm.completeLogin()
    expect(get(vm.callbackState).error).toBe('exchange failed')
    expect(navigation.replaceWith).not.toHaveBeenCalled()
  })
})
