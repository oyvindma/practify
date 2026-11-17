<script lang="ts">
  import { lyricsViewModel } from '$lib/composition'

  const { lyricsState, activeLineIndex } = lyricsViewModel

  const MANUAL_SCROLL_PAUSE_MS = 4000

  let container: HTMLDivElement | undefined = $state()
  let lastManualScrollAt = 0
  let isAutoScrolling = false

  function markManualScroll() {
    lastManualScrollAt = Date.now()
  }

  $effect(() => {
    const index = $activeLineIndex
    if (!container || index < 0) return
    if (Date.now() - lastManualScrollAt < MANUAL_SCROLL_PAUSE_MS) return
    const line = container.querySelector<HTMLElement>(`[data-line="${index}"]`)
    if (!line) return
    const lineCenter = line.offsetTop + line.clientHeight / 2
    const middle = container.scrollTop + container.clientHeight / 2
    const isAboveView = line.offsetTop < container.scrollTop
    // Lines above the middle stay put; only scroll once the line would pass it
    if (lineCenter <= middle && !isAboveView) return
    isAutoScrolling = true
    container.scrollTo({ top: lineCenter - container.clientHeight / 2, behavior: 'smooth' })
    setTimeout(() => (isAutoScrolling = false), 600)
  })

  function onScroll() {
    if (!isAutoScrolling) markManualScroll()
  }
</script>

<div class="bg-gray-800 rounded-lg p-4">
  <h3 class="text-sm font-semibold text-gray-200 mb-3">Tekst</h3>

  {#if $lyricsState.status === 'loading'}
    <p class="text-gray-500 text-sm">Henter tekst …</p>
  {:else if $lyricsState.status === 'notFound'}
    <p class="text-gray-500 text-sm">Fant ingen tekst for denne låten.</p>
  {:else if $lyricsState.status === 'error'}
    <p class="text-red-400 text-sm">Kunne ikke hente tekst. Prøv igjen senere.</p>
  {:else if $lyricsState.lyrics}
    <div
      bind:this={container}
      onscroll={onScroll}
      class="relative overflow-y-scroll max-h-[50vh] pr-2 space-y-2"
    >
      {#each $lyricsState.lyrics.lines as line, index (index)}
        <p
          data-line={index}
          class="text-base leading-snug transition-colors {$lyricsState.lyrics.synced
            ? index === $activeLineIndex
              ? 'text-green-400 font-semibold'
              : index < $activeLineIndex
                ? 'text-gray-500'
                : 'text-gray-300'
            : 'text-gray-300'}"
        >
          {line.text || ' '}
        </p>
      {/each}
    </div>
  {/if}
</div>
