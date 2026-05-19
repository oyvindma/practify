<script lang="ts">
  import { sortedBookmarks } from '$lib/stores/bookmarkStore'
  import { playerStore } from '$lib/stores/playerStore'
  import BookmarkItem from './BookmarkItem.svelte'
  import BookmarkEditor from './BookmarkEditor.svelte'
  import type { Bookmark } from '$lib/bookmarks/types'

  interface Props {
    showEditor?: boolean
    onEditRequest?: (bookmark: Bookmark) => void
  }

  let { showEditor = true, onEditRequest }: Props = $props()

  let editingBookmark = $state<Bookmark | null>(null)

  function handleEdit(bookmark: Bookmark) {
    if (onEditRequest) {
      onEditRequest(bookmark)
    } else {
      editingBookmark = bookmark
    }
  }
</script>

{#if $playerStore.track}
  <div class="space-y-3">
    <h2 class="text-lg font-semibold text-white">Loops</h2>

    {#if $sortedBookmarks.length === 0}
      <p class="text-sm text-gray-400">
        Ingen loops registrert for denne låten. Legg til din første nedenfor.
      </p>
    {:else}
      <div class="space-y-1.5">
        {#each $sortedBookmarks as bookmark (bookmark.id)}
          <BookmarkItem {bookmark} onEdit={handleEdit} />
        {/each}
      </div>
    {/if}

    {#if showEditor}
      <BookmarkEditor {editingBookmark} onDoneEditing={() => (editingBookmark = null)} />
    {/if}
  </div>
{/if}
