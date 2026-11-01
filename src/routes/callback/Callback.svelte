<script lang="ts">
  import { onMount } from 'svelte'
  import { callbackViewModel } from '$lib/composition'

  const { callbackState, completeLogin } = callbackViewModel

  onMount(completeLogin)
</script>

<div class="min-h-screen flex items-center justify-center bg-gray-950">
  {#if $callbackState.error}
    <div class="text-center space-y-4">
      <p class="text-red-400">{$callbackState.error}</p>
      <a href={import.meta.env.BASE_URL} class="text-green-400 underline text-sm"
        >Tilbake til forsiden</a
      >
    </div>
  {:else}
    <p class="text-gray-400">Logger inn…</p>
  {/if}
</div>
