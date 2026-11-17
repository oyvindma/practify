<script lang="ts">
  import { shortcutsViewModel } from '$lib/composition'
  import { SHORTCUT_HELP } from '$lib/models/shortcuts'

  const { isHelpOpen, closeHelp } = shortcutsViewModel

  let closeButton: HTMLButtonElement | undefined = $state()

  $effect(() => {
    if ($isHelpOpen) closeButton?.focus()
  })
</script>

{#if $isHelpOpen}
  <div
    class="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
    role="presentation"
    onclick={(e) => e.target === e.currentTarget && closeHelp()}
  >
    <div
      class="w-full max-w-lg rounded-xl bg-gray-900 p-6 shadow-xl ring-1 ring-gray-700"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
    >
      <div class="mb-4 flex items-center justify-between">
        <h2 id="shortcuts-title" class="text-lg font-semibold text-white">Hurtigtaster</h2>
        <button
          bind:this={closeButton}
          type="button"
          onclick={closeHelp}
          class="rounded-lg px-2 py-1 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
          aria-label="Lukk"
        >
          ✕
        </button>
      </div>

      <dl class="space-y-2">
        {#each SHORTCUT_HELP as entry (entry.description)}
          <div class="flex items-start gap-4">
            <dt class="flex w-28 shrink-0 flex-wrap gap-1">
              {#each entry.keys as key (key)}
                <kbd
                  class="rounded border border-gray-600 bg-gray-800 px-2 py-0.5 font-mono text-xs text-gray-100"
                  >{key}</kbd
                >
              {/each}
            </dt>
            <dd class="text-sm text-gray-300">{entry.description}</dd>
          </div>
        {/each}
      </dl>

      <p class="mt-4 text-xs text-gray-500">Trykk Esc eller ? for å lukke.</p>
    </div>
  </div>
{/if}
