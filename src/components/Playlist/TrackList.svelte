<script lang="ts">
  import { getPlaylistTracks, type SpotifyPlaylist, type SpotifyTrack } from '$lib/spotify/api'
  import { playerStore } from '$lib/stores/playerStore'
  import { formatMs } from '$lib/bookmarks/time'

  interface Props {
    playlist: SpotifyPlaylist
    onBack: () => void
  }

  let { playlist, onBack }: Props = $props()

  let tracks: SpotifyTrack[] = $state([])
  let loading = $state(true)
  let error = $state<string | null>(null)

  $effect(async () => {
    try {
      tracks = await getPlaylistTracks(playlist.id)
    } catch (e) {
      error = e instanceof Error ? e.message : 'Kunne ikke hente låter'
    } finally {
      loading = false
    }
  })

  async function playTrack(track: SpotifyTrack) {
    playerStore.setTrack(track)
    await playerStore.play(track.uri)
  }
</script>

<div class="p-4 bg-gray-900 rounded-xl">
  <div class="flex items-center gap-2 mb-3">
    <button onclick={onBack} class="text-gray-400 hover:text-white transition-colors p-1 rounded">
      ← Tilbake
    </button>
    <h2 class="text-lg font-semibold text-white truncate">{playlist.name}</h2>
  </div>

  {#if loading}
    <p class="text-gray-400 text-sm">Laster låter…</p>
  {:else if error}
    <p class="text-red-400 text-sm">⚠️ {error}</p>
  {:else if tracks.length === 0}
    <p class="text-gray-400 text-sm">Ingen låter i denne spillelisten.</p>
  {:else}
    <ul class="space-y-1 max-h-96 overflow-y-auto">
      {#each tracks as track (track.id)}
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
            <span class="text-xs text-gray-500 shrink-0">{formatMs(track.duration_ms, 'seconds')}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>
