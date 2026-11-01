import { writable, type Readable } from 'svelte/store'
import type { ISpotifyAuthService } from '$lib/services/SpotifyAuthService'
import type { ISpotifyApiService } from '$lib/services/SpotifyApiService'
import type { INavigationService } from '$lib/services/NavigationService'
import type { AuthViewModel } from './AuthViewModel'

export interface CallbackState {
  error: string | null
}

export interface CallbackViewModel {
  callbackState: Readable<CallbackState>
  completeLogin(): Promise<void>
}

export function isOAuthCallback(locationSearch: string): boolean {
  const params = new URLSearchParams(locationSearch)
  return params.has('code') || params.has('error')
}

export function createCallbackViewModel(
  locationSearch: string,
  homeUrl: string,
  authService: ISpotifyAuthService,
  apiService: ISpotifyApiService,
  auth: Pick<AuthViewModel, 'storeTokens' | 'storeDisplayName'>,
  navigation: INavigationService,
): CallbackViewModel {
  const stateStore = writable<CallbackState>({ error: null })

  function fail(message: string) {
    stateStore.set({ error: message })
  }

  return {
    callbackState: { subscribe: stateStore.subscribe },

    async completeLogin() {
      const params = new URLSearchParams(locationSearch)
      const code = params.get('code')
      const errorParam = params.get('error')

      if (errorParam) return fail(`Spotify avviste innloggingen: ${errorParam}`)
      if (!code) return fail('Ingen autorisasjonskode mottatt')
      if (!authService.validateAndConsumeState(params.get('state'))) {
        return fail('Ugyldig state-parameter (mulig CSRF-angrep)')
      }

      try {
        auth.storeTokens(await authService.exchangeCodeForToken(code))
        const user = await apiService.getCurrentUser()
        auth.storeDisplayName(user.display_name)
        navigation.replaceWith(homeUrl)
      } catch (e) {
        fail(e instanceof Error ? e.message : 'Innlogging feilet')
      }
    },
  }
}
