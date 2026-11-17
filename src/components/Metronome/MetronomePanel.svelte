<script lang="ts">
  import { metronomeViewModel, playerViewModel } from '$lib/composition'
  import { formatMs } from '$lib/models/time'
  import { MAX_BPM, MIN_BPM } from '$lib/models/metronome'

  const {
    metronomeState,
    practicePositionMs,
    setBpm,
    nudgeBpm,
    scaleBpm,
    tap,
    toggle,
    toggleSync,
    tapBeat,
    nudgeBeatOffset,
    resetSync,
    setMode,
  } = metronomeViewModel
  const { playerState } = playerViewModel

  const BEAT_NUDGE_MS = 10

  const syncButtonClass =
    'px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg ring-1 ring-gray-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-gray-700'

  // Pointer-down rather than click: click fires on release, which would bias the tapped beat late
  function tapBeatOnKey(e: KeyboardEvent) {
    if (e.repeat || (e.key !== ' ' && e.key !== 'Enter')) return
    e.preventDefault()
    tapBeat()
  }

  const canSync = $derived(
    $metronomeState.mode === 'withSong' && $metronomeState.bpm !== null && $playerState.isPlaying,
  )

  const buttonClass =
    'px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors disabled:opacity-40 disabled:hover:bg-gray-700'
</script>

<div class="bg-gray-800 rounded-lg p-4 space-y-3">
  <h3 class="text-sm font-semibold text-gray-200">Metronom</h3>

  <div class="flex rounded-lg bg-gray-700 p-0.5 text-sm" role="group" aria-label="Øvingsmodus">
    {#each [{ mode: 'withSong', label: 'Med låt' }, { mode: 'silent', label: 'Uten låt' }] as option (option.mode)}
      <button
        type="button"
        onclick={() => setMode(option.mode as 'withSong' | 'silent')}
        aria-pressed={$metronomeState.mode === option.mode}
        class="flex-1 px-3 py-1.5 rounded-md transition-colors {$metronomeState.mode === option.mode
          ? 'bg-green-500 text-black font-medium'
          : 'text-gray-300 hover:text-white'}"
      >
        {option.label}
      </button>
    {/each}
  </div>

  <div class="flex items-center gap-2">
    <button type="button" class={buttonClass} onclick={() => nudgeBpm(-1)} aria-label="Senk tempo">
      −
    </button>
    <input
      type="number"
      step="0.1"
      min={MIN_BPM}
      max={MAX_BPM}
      value={$metronomeState.bpm ?? ''}
      onchange={(e) => setBpm(e.currentTarget.valueAsNumber)}
      placeholder="BPM"
      aria-label="BPM"
      class="w-24 px-3 py-2 bg-gray-700 text-white text-sm text-center rounded-lg placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
    />
    <button type="button" class={buttonClass} onclick={() => nudgeBpm(1)} aria-label="Øk tempo">
      +
    </button>
    <button
      type="button"
      class={buttonClass}
      disabled={$metronomeState.bpm === null}
      onclick={() => scaleBpm(0.5)}
      aria-label="Halver tempo"
    >
      ÷2
    </button>
    <button
      type="button"
      class={buttonClass}
      disabled={$metronomeState.bpm === null}
      onclick={() => scaleBpm(2)}
      aria-label="Doble tempo"
    >
      ×2
    </button>
  </div>

  <div class="flex items-center gap-2">
    <button
      type="button"
      onclick={toggle}
      disabled={$metronomeState.bpm === null}
      class="px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-40 {$metronomeState.isRunning
        ? 'bg-red-600 hover:bg-red-500 text-white'
        : 'bg-green-500 hover:bg-green-400 text-black'}"
    >
      {$metronomeState.isRunning ? 'Stopp' : 'Start'}
    </button>
    <button type="button" class={buttonClass} onclick={() => tap()}>Tapp tempo</button>
  </div>

  <div class="space-y-2">
    {#if $metronomeState.isSyncing}
      <div class="flex items-center gap-2">
        <button
          type="button"
          onpointerdown={tapBeat}
          onkeydown={tapBeatOnKey}
          class="flex-1 px-4 py-3 bg-green-500 hover:bg-green-400 text-black text-sm font-medium rounded-lg select-none touch-manipulation"
        >
          Trykk på taktslaget ({$metronomeState.syncTapCount})
        </button>
        <button type="button" class={buttonClass} onclick={toggleSync}>Ferdig</button>
      </div>
    {:else}
      <div class="flex flex-wrap items-center gap-2">
        <button type="button" class={syncButtonClass} disabled={!canSync} onclick={toggleSync}>
          {$metronomeState.beatOffsetMs === null ? 'Synk til låten' : 'Synk på nytt'}
        </button>
        {#if $metronomeState.beatOffsetMs !== null}
          <button
            type="button"
            class={buttonClass}
            onclick={() => nudgeBeatOffset(-BEAT_NUDGE_MS)}
            aria-label="Flytt klikkene 10 ms tidligere"
          >
            ◀ Tidligere
          </button>
          <button
            type="button"
            class={buttonClass}
            onclick={() => nudgeBeatOffset(BEAT_NUDGE_MS)}
            aria-label="Flytt klikkene 10 ms senere"
          >
            Senere ▶
          </button>
          <button type="button" class={buttonClass} onclick={resetSync}>Nullstill synk</button>
        {/if}
      </div>
    {/if}
    {#if $metronomeState.isSyncing}
      <p class="text-gray-400 text-xs">
        Trykk i takt med låten, minst 4 ganger. Trykk gjerne på hvert andre slag.
      </p>
    {:else if $metronomeState.mode === 'silent'}
      <p class="text-gray-400 text-xs">Bytt til «Med låt» og spill av låten for å synke.</p>
    {:else if $metronomeState.bpm === null}
      <p class="text-gray-400 text-xs">Skriv inn BPM før du synker.</p>
    {:else if !$playerState.isPlaying}
      <p class="text-gray-400 text-xs">Spill av låten for å synke klikkene til taktslagene.</p>
    {:else if $metronomeState.beatOffsetMs === null}
      <p class="text-gray-400 text-xs">
        Trykk «Synk til låten» og tapp i takt for at klikkene skal treffe taktslagene.
      </p>
    {/if}
  </div>

  {#if $metronomeState.mode === 'silent'}
    <p class="text-gray-400 text-xs">
      Spotify er pauset. Tekst og metronom går i takt fra
      <span class="font-mono text-gray-200">{formatMs($practicePositionMs ?? 0, 'seconds')}</span>
      {#if $playerState.activeLoop}
        og gjentar loopen.
      {:else}
        – klikk på en tekstlinje for å starte derfra.
      {/if}
    </p>
  {:else if $metronomeState.isRunning && !$playerState.isPlaying}
    <p class="text-gray-400 text-xs">Metronomen starter i takt med låten når du spiller av.</p>
  {/if}

  {#if $metronomeState.lookupStatus === 'loading'}
    <p class="text-gray-500 text-xs">Henter BPM …</p>
  {:else if $metronomeState.lookupStatus === 'notFound' || $metronomeState.lookupStatus === 'error'}
    <p class="text-gray-500 text-xs">Fant ikke BPM. Skriv inn tempo eller tapp det.</p>
  {/if}
</div>
