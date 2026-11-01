<script lang="ts">
  import { bookmarkEditorViewModel } from '$lib/composition'

  const {
    editorState,
    updateName,
    updateStartInput,
    updateEndInput,
    commitStartInput,
    commitEndInput,
    captureStartPosition,
    captureEndPosition,
    nudgeStart,
    nudgeEnd,
    cancel,
    submit,
  } = bookmarkEditorViewModel

  function nudgeWhenFocused(e: WheelEvent, nudge: (direction: 1 | -1) => void) {
    if (e.currentTarget !== document.activeElement) return
    e.preventDefault()
    nudge(e.deltaY < 0 ? 1 : -1)
  }
</script>

<div class="bg-gray-800 rounded-lg p-4 space-y-3">
  <h3 class="text-sm font-semibold text-gray-200">
    {$editorState.editingBookmark ? 'Rediger loop' : 'Legg til loop'}
  </h3>

  <div>
    <input
      type="text"
      value={$editorState.name}
      oninput={(e) => updateName(e.currentTarget.value)}
      placeholder="Navn på loop (f.eks. Vers 1, Bro)"
      class="w-full px-3 py-2 bg-gray-700 text-white text-sm rounded-lg placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
    />
  </div>

  <div class="grid grid-cols-2 gap-2">
    <div class="space-y-1">
      <p class="text-xs text-gray-400">Start</p>
      <div class="flex gap-1">
        <input
          value={$editorState.startInput}
          oninput={(e) => updateStartInput(e.currentTarget.value)}
          onblur={commitStartInput}
          onwheel={(e) => nudgeWhenFocused(e, nudgeStart)}
          class="flex-1 px-2 py-1.5 bg-gray-700 rounded text-xs text-white font-mono focus:outline-none focus:ring-2 focus:ring-green-500"
          placeholder="0:00.00"
        />
        <button
          onclick={captureStartPosition}
          class="px-2 py-1.5 bg-green-700 hover:bg-green-600 text-white text-xs rounded transition-colors"
          title="Sett til nåværende posisjon"
        >
          ●
        </button>
      </div>
    </div>
    <div class="space-y-1">
      <p class="text-xs text-gray-400">Slutt</p>
      <div class="flex gap-1">
        <input
          value={$editorState.endInput}
          oninput={(e) => updateEndInput(e.currentTarget.value)}
          onblur={commitEndInput}
          onwheel={(e) => nudgeWhenFocused(e, nudgeEnd)}
          class="flex-1 px-2 py-1.5 bg-gray-700 rounded text-xs text-white font-mono focus:outline-none focus:ring-2 focus:ring-green-500"
          placeholder="0:00.00"
        />
        <button
          onclick={captureEndPosition}
          class="px-2 py-1.5 bg-green-700 hover:bg-green-600 text-white text-xs rounded transition-colors"
          title="Sett til nåværende posisjon"
        >
          ●
        </button>
      </div>
    </div>
  </div>

  {#if $editorState.validationError}
    <p class="text-xs text-red-400">{$editorState.validationError}</p>
  {/if}

  <div class="flex gap-2">
    <button
      onclick={submit}
      class="flex-1 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg transition-colors"
    >
      {$editorState.editingBookmark ? 'Oppdater loop' : 'Lagre loop'}
    </button>
    {#if $editorState.editingBookmark || $editorState.isDirty}
      <button
        onclick={cancel}
        class="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white text-sm font-medium rounded-lg transition-colors"
      >
        Avbryt
      </button>
    {/if}
  </div>
</div>
