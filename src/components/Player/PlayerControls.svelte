<script lang="ts">
  import { playerViewModel } from '$lib/composition'
  import { formatMs } from '$lib/models/time'

  const { playerState, loopRegion, displayPositionMs, scrubTo, commitScrub, togglePlay, init } =
    playerViewModel

  const sliderValue = (e: Event) => Number((e.currentTarget as HTMLInputElement).value)
</script>

{#if $playerState.track}
  <div class="bg-gray-900 rounded-xl p-4 space-y-3">
    <div class="flex items-center gap-3">
      {#if $playerState.track.album.images[0]}
        <img
          src={$playerState.track.album.images[0].url}
          alt={$playerState.track.album.name}
          class="w-14 h-14 rounded-lg object-cover shrink-0"
        />
      {/if}
      <div class="min-w-0 flex-1">
        <p class="font-semibold text-white truncate">{$playerState.track.name}</p>
        <p class="text-sm text-gray-400 truncate">
          {$playerState.track.artists.map((a) => a.name).join(', ')}
        </p>
        {#if $playerState.activeLoop}
          <span class="text-xs text-green-400 font-medium">
            🔁 Loop: {formatMs($playerState.activeLoop.startMs, 'seconds')} – {formatMs(
              $playerState.activeLoop.endMs,
              'seconds',
            )}
          </span>
        {/if}
      </div>
    </div>

    <!-- Seek bar with optional loop region overlay -->
    <div class="relative">
      {#if $loopRegion}
        <div
          class="absolute top-1/2 -translate-y-1/2 h-1 bg-green-500 opacity-60 rounded pointer-events-none z-10"
          style="left: {$loopRegion.startPercent}%; width: {$loopRegion.widthPercent}%;"
        ></div>
      {/if}
      <input
        type="range"
        min="0"
        max={$playerState.durationMs}
        value={$displayPositionMs}
        oninput={(e) => scrubTo(sliderValue(e))}
        onchange={(e) => commitScrub(sliderValue(e))}
        class="w-full h-1 appearance-none bg-gray-600 rounded cursor-pointer relative z-20 accent-green-500"
      />
    </div>

    <div class="flex items-center justify-between text-xs text-gray-400">
      <span>{formatMs($displayPositionMs, 'seconds')}</span>
      <button
        onclick={togglePlay}
        class="w-10 h-10 flex items-center justify-center bg-white text-black rounded-full hover:scale-105 transition-transform"
      >
        {#if $playerState.isPlaying}
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
      <span>{formatMs($playerState.durationMs, 'seconds')}</span>
    </div>
    {#if $playerState.playbackError}
      <p class="text-xs text-red-400">{$playerState.playbackError}</p>
    {/if}
  </div>
{:else if $playerState.connectionError}
  <div class="bg-gray-900 rounded-xl p-4 text-center text-sm space-y-2">
    <p class="text-red-400">{$playerState.connectionError}</p>
    <button
      onclick={init}
      class="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-full transition-colors"
    >
      Prøv igjen
    </button>
  </div>
{:else if !$playerState.isReady}
  <div class="bg-gray-900 rounded-xl p-4 text-center text-gray-400 text-sm">
    Initialiserer Spotify-spiller…
  </div>
{:else}
  <div class="bg-gray-900 rounded-xl p-4 text-center text-gray-400 text-sm space-y-2">
    <p>Velg en låt for å starte avspilling</p>
    {#if $playerState.playbackError}
      <p class="text-xs text-red-400">{$playerState.playbackError}</p>
    {/if}
  </div>
{/if}
