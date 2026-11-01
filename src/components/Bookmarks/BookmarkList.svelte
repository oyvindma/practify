<script lang="ts">
  import { bookmarkViewModel, playerViewModel } from '$lib/composition'
  import BookmarkItem from './BookmarkItem.svelte'
  import BookmarkEditor from './BookmarkEditor.svelte'

  interface Props {
    showEditor?: boolean
  }

  let { showEditor = true }: Props = $props()

  const { sortedBookmarks } = bookmarkViewModel
  const { playerState } = playerViewModel
</script>

{#if $playerState.track}
  <div class="space-y-3">
    <h2 class="text-lg font-semibold text-white">Loops</h2>

    {#if $sortedBookmarks.length === 0}
      <p class="text-sm text-gray-400">
        Ingen loops registrert for denne låten. Legg til din første nedenfor.
      </p>
    {:else}
      <div class="space-y-1.5">
        {#each $sortedBookmarks as bookmark (bookmark.id)}
          <BookmarkItem {bookmark} />
        {/each}
      </div>
    {/if}

    {#if showEditor}
      <BookmarkEditor />
    {/if}
  </div>
{/if}
