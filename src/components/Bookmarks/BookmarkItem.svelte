<script lang="ts">
  import type { Bookmark } from '$lib/bookmarks/types'
  import { bookmarkStore } from '$lib/stores/bookmarkStore'
  import { playerStore } from '$lib/stores/playerStore'
  import { formatMs } from '$lib/bookmarks/time'

  interface Props {
    bookmark: Bookmark
    onEdit?: (bookmark: Bookmark) => void
  }

  let { bookmark, onEdit }: Props = $props()

  const isActive = $derived($playerStore.activeLoop?.id === bookmark.id)

  const isPlaying = $derived($playerStore.isPlaying)

  function toggleLoop() {
    if (isActive) {
      playerStore.deactivateLoop()
    } else {
      playerStore.activateLoop(bookmark.startMs, bookmark.endMs, { id: bookmark.id })
    }
  }

  function restart() {
    playerStore.seek(bookmark.startMs)
  }

  function remove() {
    bookmarkStore.remove(bookmark.id)
  }
</script>

<div
  class="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors {isActive
    ? 'bg-green-900/40 ring-1 ring-green-500'
    : 'bg-gray-700 hover:bg-gray-600'}"
>
  <div class="flex-1 min-w-0">
    <p class="text-sm font-medium text-white truncate">{bookmark.name}</p>
    <p class="text-xs text-gray-400 font-mono">
      {formatMs(bookmark.startMs)} → {formatMs(bookmark.endMs)}
    </p>
  </div>

  {#if isActive}
    <!-- Play/pause toggle -->
    <button
      onclick={() => playerStore.togglePlay()}
      class="p-1.5 rounded text-green-400 hover:text-green-300 hover:bg-gray-600 transition-colors shrink-0"
      title={isPlaying ? 'Pause' : 'Spill'}
    >
      {#if isPlaying}
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="4" width="4" height="16" rx="1" />
          <rect x="14" y="4" width="4" height="16" rx="1" />
        </svg>
      {:else}
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="5,3 19,12 5,21" />
        </svg>
      {/if}
    </button>
    <!-- Restart -->
    <button
      onclick={restart}
      class="p-1.5 rounded text-green-400 hover:text-green-300 hover:bg-gray-600 transition-colors shrink-0"
      title="Start loopen på nytt"
    >
      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
      </svg>
    </button>
  {/if}

  <button
    onclick={toggleLoop}
    class="px-2.5 py-1 rounded text-xs font-medium transition-colors shrink-0 {isActive
      ? 'bg-green-500 text-black'
      : 'bg-gray-600 hover:bg-gray-500 text-white'}"
    title={isActive ? 'Lukk loop' : 'Start loop'}
  >
    {isActive ? '✕ Lukk' : '🔁 Loop'}
  </button>

  <button
    onclick={remove}
    class="p-1.5 rounded text-gray-500 hover:text-red-400 hover:bg-gray-600 transition-colors shrink-0"
    title="Slett loop"
  >
    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
    </svg>
  </button>

  {#if onEdit}
    <button
      onclick={() => onEdit(bookmark)}
      class="p-1.5 rounded text-gray-500 hover:text-blue-400 hover:bg-gray-600 transition-colors shrink-0"
      title="Rediger loop"
    >
      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    </button>
  {/if}
</div>
