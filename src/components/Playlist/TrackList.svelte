<script lang="ts">
  import { playlistViewModel, playerViewModel } from '$lib/composition'
  import { formatMs } from '$lib/models/time'

  interface Props {
    // Fill the height given by the parent (the list scrolls) instead of using a fixed maximum
    fill?: boolean
  }

  let { fill = false }: Props = $props()

  const { playlistState, clearSelection } = playlistViewModel
  const { playTrack, playerState } = playerViewModel

  const currentTrackId = $derived($playerState.track?.id ?? null)

  let list: HTMLUListElement | undefined = $state()

  // N/P can change the track while it is scrolled out of sight
  $effect(() => {
    if (currentTrackId === null) return
    list?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' })
  })
</script>

<div class="p-4 bg-gray-900 rounded-xl {fill ? 'flex flex-col flex-1 min-h-0' : ''}">
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
    <ul bind:this={list} class="space-y-1 overflow-y-auto {fill ? 'flex-1 min-h-0' : 'max-h-96'}">
      {#each $playlistState.tracks as track (track.id)}
        {@const isCurrent = track.id === currentTrackId}
        <li>
          <button
            onclick={() => playTrack(track)}
            aria-current={isCurrent ? 'true' : undefined}
            class="w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center gap-3 {isCurrent
              ? 'bg-green-900/40 ring-1 ring-green-500'
              : 'hover:bg-gray-700'}"
          >
            {#if track.album.images[0]}
              <img
                src={track.album.images[0].url}
                alt={track.album.name}
                class="w-9 h-9 rounded object-cover shrink-0"
              />
            {/if}
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium truncate {isCurrent ? 'text-green-400' : 'text-white'}">
                {track.name}
              </p>
              <p class="text-xs text-gray-400 truncate">
                {track.artists.map((a) => a.name).join(', ')}
              </p>
            </div>
            {#if isCurrent}
              <span
                class="text-green-400 shrink-0"
                title={$playerState.isPlaying ? 'Spilles nå' : 'Valgt'}
              >
                {$playerState.isPlaying ? '▶' : '❚❚'}
              </span>
            {/if}
            <span class="text-xs text-gray-500 shrink-0"
              >{formatMs(track.duration_ms, 'seconds')}</span
            >
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>
