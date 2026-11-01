<script lang="ts">
  import { playlistViewModel, playerViewModel } from '$lib/composition'
  import { formatMs } from '$lib/models/time'

  const { playlistState, clearSelection } = playlistViewModel
  const { playTrack } = playerViewModel
</script>

<div class="p-4 bg-gray-900 rounded-xl">
  <div class="flex items-center gap-2 mb-3">
    <button
      onclick={clearSelection}
      class="text-gray-400 hover:text-white transition-colors p-1 rounded"
    >
      ← Tilbake
    </button>
    <h2 class="text-lg font-semibold text-white truncate">
      {$playlistState.selectedPlaylist?.name}
    </h2>
  </div>

  {#if $playlistState.isLoadingTracks}
    <p class="text-gray-400 text-sm">Laster låter…</p>
  {:else if $playlistState.tracksError}
    <p class="text-red-400 text-sm">⚠️ {$playlistState.tracksError}</p>
  {:else if $playlistState.tracks.length === 0}
    <p class="text-gray-400 text-sm">Ingen låter i denne spillelisten.</p>
  {:else}
    <ul class="space-y-1 max-h-96 overflow-y-auto">
      {#each $playlistState.tracks as track (track.id)}
        <li>
          <button
            onclick={() => playTrack(track)}
            class="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-3"
          >
            {#if track.album.images[0]}
              <img
                src={track.album.images[0].url}
                alt={track.album.name}
                class="w-9 h-9 rounded object-cover shrink-0"
              />
            {/if}
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-white truncate">{track.name}</p>
              <p class="text-xs text-gray-400 truncate">
                {track.artists.map((a) => a.name).join(', ')}
              </p>
            </div>
            <span class="text-xs text-gray-500 shrink-0"
              >{formatMs(track.duration_ms, 'seconds')}</span
            >
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>
