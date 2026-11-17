<script lang="ts">
  import { metronomeViewModel } from '$lib/composition'
  import { MAX_BPM, MIN_BPM } from '$lib/models/metronome'

  const { metronomeState, setBpm, nudgeBpm, scaleBpm, tap, toggle } = metronomeViewModel

  const buttonClass =
    'px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors disabled:opacity-40 disabled:hover:bg-gray-700'
</script>

<div class="bg-gray-800 rounded-lg p-4 space-y-3">
  <h3 class="text-sm font-semibold text-gray-200">Metronom</h3>

  <div class="flex items-center gap-2">
    <button type="button" class={buttonClass} onclick={() => nudgeBpm(-1)} aria-label="Senk tempo">
      −
    </button>
    <input
      type="number"
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

  {#if $metronomeState.lookupStatus === 'loading'}
    <p class="text-gray-500 text-xs">Henter BPM …</p>
  {:else if $metronomeState.lookupStatus === 'notFound' || $metronomeState.lookupStatus === 'error'}
    <p class="text-gray-500 text-xs">Fant ikke BPM. Skriv inn tempo eller tapp det.</p>
  {/if}
</div>
