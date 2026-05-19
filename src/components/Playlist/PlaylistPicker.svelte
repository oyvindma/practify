<script lang="ts">
  import { getUserPlaylists, type SpotifyPlaylist } from '$lib/spotify/api'

  interface Props {
    onSelect: (playlist: SpotifyPlaylist) => void
  }

  let { onSelect }: Props = $props()

  let playlists: SpotifyPlaylist[] = $state([])
  let loading = $state(true)
  let error = $state<string | null>(null)

  $effect(async () => {
    try {
      playlists = await getUserPlaylists()
    } catch (e) {
      error = e instanceof Error ? e.message : 'Kunne ikke hente spillelister'
    } finally {
      loading = false
    }
  })
</script>

<div class="p-4 bg-gray-900 rounded-xl">
  <h2 class="text-lg font-semibold mb-3 text-white">Spillelister</h2>

  {#if loading}
    <p class="text-gray-400 text-sm">Laster spillelister…</p>
  {:else if error}
    <p class="text-red-400 text-sm">{error}</p>
  {:else if playlists.length === 0}
    <p class="text-gray-400 text-sm">Ingen spillelister funnet.</p>
  {:else}
    <ul class="space-y-1 max-h-72 overflow-y-auto">
      {#each playlists as playlist (playlist.id)}
        <li>
          <button
            onclick={() => onSelect(playlist)}
            class="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-3"
          >
            {#if playlist.images[0]}
              <img src={playlist.images[0].url} alt={playlist.name} class="w-8 h-8 rounded object-cover" />
            {:else}
              <div class="w-8 h-8 bg-gray-600 rounded flex items-center justify-center text-xs">🎵</div>
            {/if}
            <div class="min-w-0">
              <p class="text-sm font-medium text-white truncate">{playlist.name}</p>
              <p class="text-xs text-gray-400">{playlist.items?.total ?? '?'} låter</p>
            </div>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>
