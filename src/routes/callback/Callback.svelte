<script lang="ts">
  import { onMount } from 'svelte'
  import { exchangeCodeForToken, validateAndConsumeState } from '$lib/spotify/auth'
  import { authStore } from '$lib/stores/authStore'
  import { getCurrentUser } from '$lib/spotify/api'

  let error = $state<string | null>(null)

  onMount(async () => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const returnedState = params.get('state')
    const errorParam = params.get('error')

    if (errorParam) {
      error = `Spotify avviste innloggingen: ${errorParam}`
      return
    }

    if (!code) {
      error = 'Ingen autorisasjonskode mottatt'
      return
    }

    if (!validateAndConsumeState(returnedState)) {
      error = 'Ugyldig state-parameter (mulig CSRF-angrep)'
      return
    }

    try {
      const tokens = await exchangeCodeForToken(code)
      authStore.setTokens(tokens)

      const user = await getCurrentUser()
      authStore.setDisplayName(user.display_name)

      window.location.replace(import.meta.env.BASE_URL)
    } catch (e) {
      error = e instanceof Error ? e.message : 'Innlogging feilet'
    }
  })
</script>

<div class="min-h-screen flex items-center justify-center bg-gray-950">
  {#if error}
    <div class="text-center space-y-4">
      <p class="text-red-400">{error}</p>
      <a href={import.meta.env.BASE_URL} class="text-green-400 underline text-sm">Tilbake til forsiden</a>
    </div>
  {:else}
    <p class="text-gray-400">Logger inn…</p>
  {/if}
</div>
