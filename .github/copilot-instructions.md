# Copilot Instructions

## Commands

```bash
npm run dev          # Dev server at http://localhost:5173
npm test             # Run tests once (Vitest)
npm run test:watch   # Run tests in watch mode
npx vitest run src/lib/bookmarks/__tests__/store.test.ts  # Run a single test file
npm run lint         # ESLint
npm run format       # Prettier
npm run check        # svelte-check + tsc type check
npm run build        # Production build
```

## Architecture

Single-page app (no backend). Spotify Premium required — playback runs via the Spotify Web Playback SDK directly in the browser.

**Three-layer structure:**

1. **Pure logic** (`src/lib/bookmarks/`, `src/lib/spotify/`) — plain TypeScript functions and interfaces, no Svelte. This is the testable layer.
2. **Svelte stores** (`src/lib/stores/`) — reactive wrappers around the pure layer. Stores use the factory pattern: `createXxxStore()` returns an object with `subscribe` + methods, exported as a singleton.
3. **UI** (`src/components/`, `src/App.svelte`) — Svelte 5 components that consume stores.

**Spotify integration:**
- `src/lib/spotify/auth.ts` — PKCE OAuth flow (pure functions, uses `sessionStorage` for verifier/state)
- `src/lib/spotify/authPersistence.ts` — `localStorage` read/write for persisted auth tokens
- `src/lib/spotify/api.ts` — Spotify Web API calls via internal `apiFetch`
- `src/lib/spotify/sdk.ts` — dynamic loader for the Spotify Web Playback SDK script

**Bookmarks:**
- `src/lib/bookmarks/types.ts` — `Bookmark` interface (`id`, `trackId`, `name`, `startMs`, `endMs`)
- `src/lib/bookmarks/store.ts` — CRUD against `localStorage`, keyed as `bookmarks_<trackId>`
- `src/lib/bookmarks/time.ts` — `formatMs` / `parseMs` / `adjustMs` utilities
- `src/lib/stores/bookmarkStore.ts` — reactive store wrapping the above; `sortedBookmarks` derived store sorts by `startMs`

**Player loop:** `playerStore` manages a 100 ms polling loop (`setTimeout`) that seeks back to `startMs` whenever `positionMs >= endMs`. Progress polling (`setInterval` at 500 ms) is paused while the loop is active.

## Key Conventions

**Path alias:** `$lib` resolves to `src/lib`. Use it for all internal imports instead of relative paths from component files.

**Time values are always milliseconds** with an `Ms` suffix. Display format is `m:ss.cs` (e.g. `3:17.45`). Use `formatMs` / `parseMs` from `src/lib/bookmarks/time.ts`.

**Svelte 5 runes:** `.svelte` files use `$state`, `$effect`, and `$derived`. Do not use Svelte 4-style `$:` reactive statements.

**Tests live in `__tests__/`** subdirectories next to the module they test (e.g. `src/lib/bookmarks/__tests__/store.test.ts`). Tests target the pure logic layer — not stores or components. The Vitest environment is `jsdom`, so `localStorage` is available in tests.

**Auth flow:** `authStore.getValidToken()` handles silent refresh automatically. All API calls and SDK token callbacks go through it — never read the token directly from `localStorage`.

**`bookmarkStore` is track-scoped:** Call `bookmarkStore.setTrackId(trackId)` when the active track changes; the store reloads from `localStorage` automatically. This happens in `App.svelte` via `$effect`.

**MVVM for components:** Each non-trivial component should have a companion ViewModel — a plain TypeScript file (e.g. `BookmarkEditor.vm.ts`) that holds derived state, input handlers, and business logic. The `.svelte` file is the View: it binds to the ViewModel and contains no logic beyond rendering. The Model is the store/pure-logic layer. This keeps `.svelte` files thin and the ViewModel independently testable.

## Developer Flow

1. **Structural refactoring first** — reorganize, rename, or extract code to make the implementation clean before writing new logic. Commit separately.
2. **Verify tests are green** before starting.
3. **Write the test** for the new functionality (targeting the pure logic layer).
4. **Implement** the functionality.
5. **Verify tests are green** again.

Apply throughout:
- **Single responsibility** — each function/module does one thing.
- **Small changes at a time** — prefer many small commits over large ones.
- **Separation of concerns** — keep pure logic, reactive stores, and UI strictly separated.
