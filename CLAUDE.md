# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Practify (package `spotify-practice`) is a client-only Svelte 5 + Vite + TypeScript SPA (no backend/SSR) for musicians. Users log in with Spotify OAuth (PKCE), play tracks through the Spotify Web Playback SDK (Premium required), and save named loop "bookmarks" (start/end ms) that auto-seek back at the end. Bookmarks live in `localStorage`. README and all user-facing UI text are in Norwegian (Bokmål). Styling is Tailwind CSS 4 (dark theme, `green-500` accent).

## Commands

```bash
npm run dev          # Vite dev server on http://127.0.0.1:5173
npm test             # vitest run (jsdom, globals enabled)
npm run test:watch
npx vitest run src/lib/viewmodels/__tests__/PlayerViewModel.test.ts   # single file
npx vitest run -t "name substring"                         # single test by name
npm run check        # svelte-check + tsc
npm run lint         # eslint src
npm run format       # prettier --write src
npm run build
```

Env (copy `.env.example` → `.env`): `VITE_SPOTIFY_CLIENT_ID`, `VITE_REDIRECT_URI` (`http://localhost:5173/callback` locally). `package-lock.json` is gitignored, so use `npm install`, not `npm ci`. Deploys to GitHub Pages (base path `/practify/`) via GitHub Actions on push to the `prod` branch.

## Architecture

Alias `$lib` → `src/lib`. Strict MVVM; Svelte components hold no business logic.

- **Models** — `src/lib/models/`: pure types and domain functions (`bookmark`, `spotify`, `player` incl. `PlayerState`/`toLoopRegion`, `time` with `formatMs`/`parseMs`/`adjustMs`).
- **Playback** — `src/lib/playback/LoopEngine.ts`: plain class owning the position polling (500 ms) and loop enforcement (100 ms), driven by `PlayerViewModel` through a `PlaybackSource` (snapshot + seek) and an `onPosition` callback.
- **Services** — `src/lib/services/`: thin wrappers over external dependencies, each with an `I…Service` interface (`SpotifyAuthService`, `SpotifyApiService`, `SpotifyPlayerService` over the Web Playback SDK, `BookmarkStorageService` over `localStorage` key `bookmarks_<trackId>`, `NavigationService`). `src/lib/spotify/` holds the low-level PKCE auth (`auth.ts`, `authPersistence.ts`) and dynamic SDK script loader (`sdk.ts`) that the services wrap; the SDK is not an npm package.
- **ViewModels** — `src/lib/viewmodels/` (`XxxViewModel.ts`): `createXxxViewModel(...deps)` factories returning Svelte `Readable` stores plus action methods; all dependencies (services or other ViewModels) are injected, so tests use plain fakes. Existing: Auth, Callback, Playlist, Player, Bookmark, BookmarkEditor, App.
- **Composition root** — `src/lib/composition.ts` wires the singleton ViewModels; components import from it (`import { playerViewModel } from '$lib/composition'`) and use `$store` auto-subscription on destructured stores. It touches `window`, so don't import it from tests or ViewModels.
- **Views** — `src/components/`, `src/App.svelte`, `src/routes/callback/Callback.svelte`.

Key behaviors that span files:
- **Auth**: tokens come only from `authViewModel.getValidToken()` (silent refresh, logs out on failure); `SpotifyApiService` and the SDK token callback receive it as a provider. Never read the token from `localStorage` directly.
- **Loop**: `PlayerViewModel` holds `activeLoop` state and delegates mechanics to `LoopEngine`: poll every 100 ms, seek to `startMs` when `positionMs >= endMs` (not while paused, never with a seek in flight). The 500 ms progress poll only runs while playing with no loop. `activateLoop` seeks; `retimeActiveLoop` changes bounds without seeking; `deactivatePreviewLoop` only stops `id === null` loops. `toggleLoop` activates/deactivates a bookmark's loop.
- **Playback source of truth**: `playTrack` commits `track`/clears the loop only after the Web API accepts the request; afterwards `PlayerViewModel` adopts whatever track the SDK reports (ignoring events about the old track while one is pending). SDK errors land in `connectionError` / `playbackError` on `PlayerState`. Seek-slider drags go through `scrubTo`/`commitScrub` (throttled seeks, `displayPositionMs`).
- **Wiring**: `AppViewModel.start()` (called from `App.svelte` `onMount`, returns the cleanup) initialises the player on login and destroys it on logout, points `BookmarkViewModel` at the playing track, and keeps the active loop in sync when its bookmark is edited (retime) or deleted (stop). Loops without an `id` are editor previews and are left alone by that sync.
- **Editor**: one shared `BookmarkEditorViewModel` backs both layouts. It keeps timestamp text separately from parsed ms, commits on blur, captures a fresh SDK position (async), debounces a 500 ms preview loop, and handles create vs. edit via `beginEditing(bookmark)`. Every reset stops its preview loop; it resets itself on track change and when the edited bookmark disappears.

## Conventions

- Time values are always milliseconds with an `Ms` suffix; display format is `m:ss.cs` (e.g. `3:17.45`) via `formatMs`/`parseMs`/`adjustMs` in `src/lib/models/time.ts`.
- Svelte 5 runes only (`$state`, `$derived`, `$effect`, `$props` with an explicit `interface Props`); no `$:` or `export let`; use `mount()` from `svelte`.
- Prettier: no semicolons, single quotes, trailing commas, 100 cols. Prefer `interface` over `type`, avoid `any`, named exports (default only for Svelte components), import order external → `$lib/` → relative.
- Naming over comments: express intent through names; comment only non-obvious *why*. No JSDoc restating signatures.
- Tests are colocated in `__tests__/` as `<FileName>.test.ts`, targeting pure logic, ViewModels, and services (not components). Use `vi.fn()`/`vi.spyOn()`/`vi.stubEnv()`.
- Workflow preferred by the repo: do structural refactoring first (commit separately), confirm tests are green, write the test, implement, confirm green; keep commits small.
