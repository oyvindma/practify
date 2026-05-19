<script lang="ts">
  import { playerStore } from '$lib/stores/playerStore'
  import { formatMs } from '$lib/bookmarks/time'
  function handleSeek(e: Event) {
    const input = e.target as HTMLInputElement
    playerStore.seek(Number(input.value))
  }

  function togglePlay() {
    if ($playerStore.isPlaying) {
      playerStore.pause()
    } else {
      playerStore.resume()
    }
  }
</script>

{#if $playerStore.track}
  <div class="bg-gray-900 rounded-xl p-4 space-y-3">
    <div class="flex items-center gap-3">
      {#if $playerStore.track.album.images[0]}
        <img
          src={$playerStore.track.album.images[0].url}
          alt={$playerStore.track.album.name}
          class="w-14 h-14 rounded-lg object-cover shrink-0"
        />
      {/if}
      <div class="min-w-0 flex-1">
        <p class="font-semibold text-white truncate">{$playerStore.track.name}</p>
        <p class="text-sm text-gray-400 truncate">
          {$playerStore.track.artists.map((a) => a.name).join(', ')}
        </p>
        {#if $playerStore.activeLoop}
          <span class="text-xs text-green-400 font-medium">
            🔁 Loop: {formatMs($playerStore.activeLoop.startMs, 'seconds')} – {formatMs($playerStore.activeLoop.endMs, 'seconds')}
          </span>
        {/if}
      </div>
    </div>

    <!-- Seek bar with optional loop region overlay -->
    <div class="relative">
      {#if $playerStore.activeLoop && $playerStore.durationMs > 0}
        {@const startPct = ($playerStore.activeLoop.startMs / $playerStore.durationMs) * 100}
        {@const endPct = ($playerStore.activeLoop.endMs / $playerStore.durationMs) * 100}
        <div
          class="absolute top-1/2 -translate-y-1/2 h-1 bg-green-500 opacity-60 rounded pointer-events-none z-10"
          style="left: {startPct}%; width: {endPct - startPct}%;"
        ></div>
      {/if}
      <input
        type="range"
        min="0"
        max={$playerStore.durationMs}
        value={$playerStore.positionMs}
        oninput={handleSeek}
        class="w-full h-1 appearance-none bg-gray-600 rounded cursor-pointer relative z-20 accent-green-500"
      />
    </div>

    <div class="flex items-center justify-between text-xs text-gray-400">
      <span>{formatMs($playerStore.positionMs, 'seconds')}</span>
      <button
        onclick={togglePlay}
        class="w-10 h-10 flex items-center justify-center bg-white text-black rounded-full hover:scale-105 transition-transform"
      >
        {#if $playerStore.isPlaying}
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg>
        {:else}
          <svg class="w-4 h-4 ml-0.5" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5,3 19,12 5,21" />
          </svg>
        {/if}
      </button>
      <span>{formatMs($playerStore.durationMs, 'seconds')}</span>
    </div>
  </div>
{:else if !$playerStore.isReady}
  <div class="bg-gray-900 rounded-xl p-4 text-center text-gray-400 text-sm">
    Initialiserer Spotify-spiller…
  </div>
{:else}
  <div class="bg-gray-900 rounded-xl p-4 text-center text-gray-400 text-sm">
    Velg en låt for å starte avspilling
  </div>
{/if}
