<script lang="ts">
  import { get } from 'svelte/store'
  import { playerStore } from '$lib/stores/playerStore'
  import { bookmarkStore } from '$lib/stores/bookmarkStore'
  import type { Bookmark } from '$lib/bookmarks/types'
  import { formatMs, parseMs, adjustMs } from '$lib/bookmarks/time'

  interface Props {
    editingBookmark?: Bookmark | null
    onDoneEditing?: () => void
  }

  let { editingBookmark = null, onDoneEditing }: Props = $props()

  let name = $state('')
  let startMs = $state(0)
  let endMs = $state(0)
  let error = $state<string | null>(null)
  let isDirty = $state(false)

  let startInput = $state(formatMs(0))
  let endInput = $state(formatMs(0))

  // Keep inputs in sync when startMs/endMs are updated programmatically,
  // but only when the inputs are not currently focused (would overwrite user typing).
  let startFocused = false
  let endFocused = false

  $effect(() => { if (!startFocused) startInput = formatMs(startMs) })
  $effect(() => { if (!endFocused) endInput = formatMs(endMs) })

  // Populate form when an editing bookmark is passed in.
  $effect(() => {
    if (editingBookmark) {
      name = editingBookmark.name
      startMs = editingBookmark.startMs
      endMs = editingBookmark.endMs
      startInput = formatMs(editingBookmark.startMs)
      endInput = formatMs(editingBookmark.endMs)
      error = null
    }
  })

  let previewTimer: ReturnType<typeof setTimeout> | null = null

  function schedulePreview(start: number, end: number, options?: { startFrom?: number }) {
    if (previewTimer) clearTimeout(previewTimer)
    if (start >= end) return
    previewTimer = setTimeout(() => {
      playerStore.activateLoop(start, end, options)
    }, 500)
  }

  function cancelPreview() {
    if (previewTimer) { clearTimeout(previewTimer); previewTimer = null }
  }

  function fillEndFromTrackIfEmpty() {
    if (endMs === 0) {
      endMs = get(playerStore).durationMs
    }
  }

  function setStart() {
    startMs = get(playerStore).positionMs
    startInput = formatMs(startMs)
    fillEndFromTrackIfEmpty()
    isDirty = true
    schedulePreview(startMs, endMs)
  }

  function setEnd() {
    endMs = get(playerStore).positionMs
    endInput = formatMs(endMs)
    isDirty = true
    schedulePreview(startMs, endMs, { startFrom: Math.max(0, endMs - 2000) })
  }

  function onStartBlur() {
    const ms = parseMs(startInput)
    if (ms !== null) startMs = ms
    else startInput = formatMs(startMs)
    fillEndFromTrackIfEmpty()
    isDirty = true
    schedulePreview(startMs, endMs)
  }

  function onEndBlur() {
    const ms = parseMs(endInput)
    if (ms !== null) endMs = ms
    else endInput = formatMs(endMs)
    isDirty = true
    schedulePreview(startMs, endMs, { startFrom: Math.max(0, endMs - 2000) })
  }

  function onStartWheel(e: WheelEvent) {
    if (!startFocused) return
    e.preventDefault()
    startMs = adjustMs(startMs, e.deltaY < 0 ? 100 : -100)
    startInput = formatMs(startMs)
    fillEndFromTrackIfEmpty()
    isDirty = true
    schedulePreview(startMs, endMs)
  }

  function onEndWheel(e: WheelEvent) {
    if (!endFocused) return
    e.preventDefault()
    endMs = adjustMs(endMs, e.deltaY < 0 ? 100 : -100)
    endInput = formatMs(endMs)
    isDirty = true
    schedulePreview(startMs, endMs, { startFrom: Math.max(0, endMs - 2000) })
  }

  function resetForm() {
    name = ''
    startMs = 0
    endMs = 0
    startInput = formatMs(0)
    endInput = formatMs(0)
    error = null
    isDirty = false
    cancelPreview()
  }

  function submit() {
    error = null
    if (!name.trim()) {
      error = 'Gi partiet et navn'
      return
    }
    if (endMs <= startMs) {
      error = 'Slutttidspunkt må være etter starttidspunkt'
      return
    }
    if (editingBookmark) {
      bookmarkStore.edit(editingBookmark.id, name.trim(), startMs, endMs)
      onDoneEditing?.()
    } else {
      bookmarkStore.add(name.trim(), startMs, endMs)
    }
    resetForm()
  }

  function cancelEdit() {
    resetForm()
    onDoneEditing?.()
  }
</script>

<div class="bg-gray-800 rounded-lg p-4 space-y-3">
  <h3 class="text-sm font-semibold text-gray-200">
    {editingBookmark ? 'Rediger loop' : 'Legg til loop'}
  </h3>

  <div>
    <input
      type="text"
      bind:value={name}
      oninput={() => { isDirty = true }}
      placeholder="Navn på loop (f.eks. Vers 1, Bro)"
      class="w-full px-3 py-2 bg-gray-700 text-white text-sm rounded-lg placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
    />
  </div>

  <div class="grid grid-cols-2 gap-2">
    <div class="space-y-1">
      <p class="text-xs text-gray-400">Start</p>
      <div class="flex gap-1">
        <input
            bind:value={startInput}
            onfocus={() => { startFocused = true }}
            onblur={() => { startFocused = false; onStartBlur() }}
            onwheel={onStartWheel}
            class="flex-1 px-2 py-1.5 bg-gray-700 rounded text-xs text-white font-mono focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="0:00.00"
          />
        <button
          onclick={setStart}
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
            bind:value={endInput}
            onfocus={() => { endFocused = true }}
            onblur={() => { endFocused = false; onEndBlur() }}
            onwheel={onEndWheel}
            class="flex-1 px-2 py-1.5 bg-gray-700 rounded text-xs text-white font-mono focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="0:00.00"
          />
        <button
          onclick={setEnd}
          class="px-2 py-1.5 bg-green-700 hover:bg-green-600 text-white text-xs rounded transition-colors"
          title="Sett til nåværende posisjon"
        >
          ●
        </button>
      </div>
    </div>
  </div>

  {#if error}
    <p class="text-xs text-red-400">{error}</p>
  {/if}

  <div class="flex gap-2">
    <button
      onclick={submit}
      class="flex-1 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg transition-colors"
    >
      {editingBookmark ? 'Oppdater loop' : 'Lagre loop'}
    </button>
    {#if editingBookmark || isDirty}
      <button
        onclick={cancelEdit}
        class="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white text-sm font-medium rounded-lg transition-colors"
      >
        Avbryt
      </button>
    {/if}
  </div>
</div>
