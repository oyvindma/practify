import { BookmarkStorageService } from '$lib/services/BookmarkStorageService'
import { derived } from 'svelte/store'
import { PracticeClock } from '$lib/playback/PracticeClock'
import { ReccoBeatsBpmService } from '$lib/services/BpmService'
import { BpmStorageService } from '$lib/services/BpmStorageService'
import { LrclibLyricsService } from '$lib/services/LyricsService'
import { LyricsStorageService } from '$lib/services/LyricsStorageService'
import { WebAudioMetronomeService } from '$lib/services/MetronomeService'
import { BrowserNavigationService } from '$lib/services/NavigationService'
import { SpotifyApiService } from '$lib/services/SpotifyApiService'
import { SpotifyAuthService } from '$lib/services/SpotifyAuthService'
import { SpotifyPlayerService } from '$lib/services/SpotifyPlayerService'
import { createAppViewModel } from '$lib/viewmodels/AppViewModel'
import { createAuthViewModel } from '$lib/viewmodels/AuthViewModel'
import { createBookmarkEditorViewModel } from '$lib/viewmodels/BookmarkEditorViewModel'
import { createBookmarkViewModel } from '$lib/viewmodels/BookmarkViewModel'
import { createCallbackViewModel } from '$lib/viewmodels/CallbackViewModel'
import { createLyricsViewModel } from '$lib/viewmodels/LyricsViewModel'
import { createMetronomeViewModel } from '$lib/viewmodels/MetronomeViewModel'
import { createShortcutsViewModel } from '$lib/viewmodels/ShortcutsViewModel'
import { createPlayerViewModel } from '$lib/viewmodels/PlayerViewModel'
import { createPlaylistViewModel } from '$lib/viewmodels/PlaylistViewModel'

const authService = new SpotifyAuthService()
const navigation = new BrowserNavigationService()

export const authViewModel = createAuthViewModel(authService, navigation)

const apiService = new SpotifyApiService(() => authViewModel.getValidToken())

export const playerViewModel = createPlayerViewModel(
  new SpotifyPlayerService(),
  apiService,
  authViewModel,
)
export const bookmarkViewModel = createBookmarkViewModel(new BookmarkStorageService())
export const metronomeViewModel = createMetronomeViewModel(
  playerViewModel,
  new ReccoBeatsBpmService(),
  new BpmStorageService(),
  new WebAudioMetronomeService(),
  new PracticeClock(),
)
// Loop start/end are captured from the practice position while practising without the song
export const bookmarkEditorViewModel = createBookmarkEditorViewModel(bookmarkViewModel, {
  ...playerViewModel,
  getCurrentPositionMs: async () =>
    metronomeViewModel.currentPracticePositionMs() ?? playerViewModel.getCurrentPositionMs(),
})

const lyricsPositionMs = derived(
  [metronomeViewModel.practicePositionMs, playerViewModel.displayPositionMs],
  ([practicePositionMs, songPositionMs]) => practicePositionMs ?? songPositionMs,
)
export const lyricsViewModel = createLyricsViewModel(
  { playerState: playerViewModel.playerState, displayPositionMs: lyricsPositionMs },
  new LrclibLyricsService(),
  new LyricsStorageService(),
)
export const playlistViewModel = createPlaylistViewModel(apiService)
export const shortcutsViewModel = createShortcutsViewModel(
  playerViewModel,
  metronomeViewModel,
  bookmarkViewModel,
  bookmarkEditorViewModel,
  playlistViewModel,
)
export const callbackViewModel = createCallbackViewModel(
  window.location.search,
  import.meta.env.BASE_URL,
  authService,
  apiService,
  authViewModel,
  navigation,
)
export const appViewModel = createAppViewModel(
  window.location.search,
  authViewModel,
  playerViewModel,
  bookmarkViewModel,
)
