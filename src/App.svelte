<script lang="ts">
  import { onMount } from 'svelte'
  import {
    appViewModel,
    playerViewModel,
    playlistViewModel,
    shortcutsViewModel,
  } from '$lib/composition'
  import { toKeyPress } from '$lib/dom/keyPress'
  import { resolveShortcut } from '$lib/models/shortcuts'
  import LoginButton from './components/Auth/LoginButton.svelte'
  import PlaylistPicker from './components/Playlist/PlaylistPicker.svelte'
  import TrackList from './components/Playlist/TrackList.svelte'
  import PlayerControls from './components/Player/PlayerControls.svelte'
  import BookmarkList from './components/Bookmarks/BookmarkList.svelte'
  import BookmarkEditor from './components/Bookmarks/BookmarkEditor.svelte'
  import MetronomePanel from './components/Metronome/MetronomePanel.svelte'
  import LyricsPanel from './components/Lyrics/LyricsPanel.svelte'
  import ShortcutsHelp from './components/Shortcuts/ShortcutsHelp.svelte'
  import Callback from './routes/callback/Callback.svelte'

  const { isCallbackRoute, isAuthenticated, start } = appViewModel
  const { playerState } = playerViewModel
  const { playlistState } = playlistViewModel
  const { handleKey, toggleHelp } = shortcutsViewModel

  let headerHeight = $state(0)
  let playerHeight = $state(0)

  onMount(start)

  function onKeyDown(event: KeyboardEvent) {
    if (event.defaultPrevented) return
    if (handleKey(toKeyPress(event))) event.preventDefault()
  }

  // Buttons activate on Space release in some browsers, so the release is cancelled too
  function onKeyUp(event: KeyboardEvent) {
    if (resolveShortcut(toKeyPress(event)) === 'togglePlay') event.preventDefault()
  }
</script>

<svelte:window onkeydown={onKeyDown} onkeyup={onKeyUp} />

{#if isCallbackRoute}
  <Callback />
{:else}
  <ShortcutsHelp />
  <div class="min-h-screen bg-gray-950 text-white flex flex-col">
    <!-- Header -->
    <header
      bind:clientHeight={headerHeight}
      class="sticky top-0 z-50 bg-gray-950/90 backdrop-blur px-4 py-3 flex items-center justify-between shrink-0"
    >
      <div class="flex items-center gap-2">
        <span class="text-green-500 text-xl">🎸</span>
        <h1 class="font-bold text-lg">Spotify Practice</h1>
      </div>
      <div class="flex items-center gap-3">
        {#if $isAuthenticated}
          <button
            type="button"
            onclick={toggleHelp}
            class="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded-full transition-colors"
            title="Hurtigtaster (?)"
            aria-label="Vis hurtigtaster"
          >
            ?
          </button>
        {/if}
        <LoginButton />
      </div>
    </header>

    {#if $isAuthenticated}
      <!-- ── WIDE LAYOUT (lg+) ─────────────────────────────────────── -->
      <!-- Two independent flex columns; loop list min-height mirrors the player via bind:clientHeight -->
      <div class="hidden lg:flex flex-1 min-h-0">
        <!-- Left column: pinned to the viewport below the header so the lyrics stay on screen -->
        <div
          class="flex flex-col flex-1 min-h-0 self-start sticky"
          style="top: {headerHeight}px; height: calc(100vh - {headerHeight}px)"
        >
          <!-- Player: fixed height, measured for use as min-height on loop list -->
          <div class="shrink-0 p-5" bind:clientHeight={playerHeight}>
            <PlayerControls />
          </div>
          <!-- Track list: takes what it needs but shrinks before the lyrics lose height; the list itself scrolls -->
          <div class="flex-initial min-h-0 flex flex-col p-5">
            {#if $playlistState.selectedPlaylist}
              <TrackList fill />
            {:else}
              <PlaylistPicker fill />
            {/if}
          </div>
          <!-- Lyrics: use the remaining height, never less than 35vh of text plus panel chrome -->
          {#if $playerState.track}
            <div class="flex-1 flex flex-col min-h-[calc(35vh+5.25rem)] px-5 pb-5">
              <LyricsPanel fill />
            </div>
          {/if}
        </div>

        <!-- Right column -->
        <div class="flex flex-col flex-1 min-h-0">
          <!-- Loop list: min-height matches player, grows with content, scrolls when very tall -->
          <div class="overflow-y-auto p-5" style="min-height: {playerHeight}px; max-height: 60vh">
            {#if $playerState.track}
              <BookmarkList showEditor={false} />
            {:else}
              <p class="text-gray-500 text-sm">Velg og spill en låt for å se loops.</p>
            {/if}
          </div>
          <!-- Bookmark editor: sits directly below the loop list -->
          <div class="shrink-0 p-5">
            {#if $playerState.track}
              <BookmarkEditor />
            {:else}
              <p class="text-gray-500 text-sm">Spill en låt for å lagre loops.</p>
            {/if}
          </div>
          {#if $playerState.track}
            <div class="shrink-0 px-5 pb-5">
              <MetronomePanel />
            </div>
          {/if}
        </div>
      </div>

      <!-- ── NARROW LAYOUT (< lg) ──────────────────────────────────── -->
      <main class="lg:hidden max-w-2xl mx-auto w-full px-4 py-6 space-y-6">
        <PlayerControls />
        {#if $playerState.track}
          <div class="space-y-6">
            <BookmarkList />
            <MetronomePanel />
            <!-- Pinned to the bottom of the viewport while this section is on screen -->
            <div class="sticky bottom-0 z-10 bg-gray-950 pb-4 pt-2">
              <LyricsPanel />
            </div>
          </div>
        {/if}
        {#if $playlistState.selectedPlaylist}
          <TrackList />
        {:else}
          <PlaylistPicker />
        {/if}
      </main>
    {:else}
      <!-- Logged out -->
      <div class="flex flex-col items-center justify-center min-h-[70vh] gap-6 px-4 text-center">
        <div class="space-y-2">
          <h2 class="text-3xl font-bold">Øv bedre med Spotify</h2>
          <p class="text-gray-400 max-w-md">
            Logg inn med Spotify for å velge spillelister, styre avspilling og lagre loops du vil
            repetere når du øver.
          </p>
        </div>
        <LoginButton />
        <p class="text-xs text-gray-500">Krever Spotify Premium</p>
      </div>
    {/if}
  </div>
{/if}
