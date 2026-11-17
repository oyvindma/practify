<script lang="ts">
  import { lyricsViewModel, metronomeViewModel, playerViewModel } from '$lib/composition'

  interface Props {
    // Fill the height given by the parent instead of using a fixed maximum
    fill?: boolean
  }

  let { fill = false }: Props = $props()

  const { lyricsState, activeLineIndex } = lyricsViewModel
  const { playFromLyricLine } = metronomeViewModel
  const { playerState } = playerViewModel

  const canPickStartLine = $derived(!$playerState.activeLoop && $lyricsState.lyrics?.synced)

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

<div class="bg-gray-800 rounded-lg p-4 {fill ? 'flex flex-col flex-1 min-h-0' : ''}">
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
      class="relative overflow-y-scroll pr-2 space-y-2 {fill ? 'flex-1 min-h-0' : 'max-h-[35vh]'}"
    >
      {#each $lyricsState.lyrics.lines as line, index (index)}
        {@const lineClass = `text-base leading-snug transition-colors ${
          !$lyricsState.lyrics.synced
            ? 'text-gray-300'
            : index === $activeLineIndex
              ? 'text-green-400 font-semibold'
              : index < $activeLineIndex
                ? 'text-gray-500'
                : 'text-gray-300'
        }`}
        {#if canPickStartLine && line.startMs !== null}
          {@const startMs = line.startMs}
          <button
            type="button"
            data-line={index}
            onclick={() => playFromLyricLine(startMs)}
            class="block w-full text-left cursor-pointer hover:text-white {lineClass}"
          >
            {line.text || '\u00a0'}
          </button>
        {:else}
          <p data-line={index} class={lineClass}>{line.text || '\u00a0'}</p>
        {/if}
      {/each}
    </div>
  {/if}
</div>
