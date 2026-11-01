# 04 – Bookmarks

Files: `models/bookmark.ts`, `services/BookmarkStorageService.ts`, `viewmodels/BookmarkViewModel.ts`,
`viewmodels/BookmarkEditorViewModel.ts`, `models/time.ts`, `components/Bookmarks/*`.

A bookmark ("loop" in the UI, "parti" in Norwegian copy) is a named time range on one track.

## Data model

```ts
interface Bookmark      { id: string; trackId: string; name: string; startMs: number; endMs: number }
interface BookmarkDraft { name: string; startMs: number; endMs: number }
```

`id` is a UUID v4 generated on save. `trackId` is the Spotify track id (not the URI).

## Persistence (`BookmarkStorageService`)

- One `localStorage` entry **per track**: key `bookmarks_<trackId>`, value a JSON array of `Bookmark`.
- Every operation is read-modify-write of that array (`getBookmarks` → change → `setItem`).
- `getBookmarks` returns `[]` for a missing key or unparseable JSON (corrupt data is silently ignored and will be
  overwritten by the next write).
- `updateBookmark` throws `Bookmark not found: <id>` if the id is absent; `deleteBookmark` of an unknown id is a
  no-op.
- Data is per browser profile and per origin; there is no sync, versioning or migration. Logging out does **not**
  clear bookmarks.

## Track scoping (`BookmarkViewModel`)

The ViewModel mirrors one track's bookmarks in memory:

- `showBookmarksForTrack(trackId | null)` – no-op if the id is unchanged; otherwise loads from storage (or empties
  the list for `null`). `AppViewModel` calls it on every `playerState` change with `state.track?.id ?? null`.
- `addBookmark / editBookmark / deleteBookmark` act on the current track, persist through the service, then update
  the in-memory list. They silently do nothing when no track is set.
- `sortedBookmarks` is a derived store sorted ascending by `startMs`; this is what the UI renders.

The in-memory list is the UI's source of truth after load; storage is only read on track change. Editing from
another browser tab will not be reflected until the track is changed.

## Editor (`BookmarkEditorViewModel`)

One shared instance serves both layouts. Its state:

| Field | Purpose |
| --- | --- |
| `name` | Bookmark name |
| `startMs`, `endMs` | Parsed values (source of truth for saving) |
| `startInput`, `endInput` | The text shown in the timestamp inputs, kept separate so typing is not clobbered |
| `validationError` | Message or `null` |
| `isDirty` | Controls whether "Avbryt" is shown for a new bookmark |
| `editingBookmark` | `null` = creating, otherwise the bookmark being edited |

### Setting times

| Input | Action |
| --- | --- |
| ● button (start) | `captureStartPosition` (async): `startMs` = a **fresh** SDK position via `player.getCurrentPositionMs()` |
| ● button (end) | `captureEndPosition` (async): same for `endMs` |
| Typing in a field | `updateStartInput/updateEndInput`: only the text changes |
| Leaving the field (blur) | `commitStartInput/commitEndInput`: `parseMs(text)`; invalid text reverts to the last valid value |
| Mouse wheel while the field is focused | `nudgeStart/nudgeEnd(±1)`: ±100 ms, never below 0 (`adjustMs`) |

Rules:

- Whenever the **start** is set and `endMs` is still `0`, the end is filled with the track's `durationMs`. This
  makes "set start" immediately produce a valid loop from there to the end of the track.
- Each of those actions sets `isDirty` and schedules a preview loop (see doc 03).
- Timestamp text format: `m:ss.cs`. `parseMs` accepts `m:ss.c` or `m:ss.cc` only (the fractional part is
  required; `.4` means 400 ms, `.04` means 40 ms); seconds must be < 60. Output of `formatMs` is always
  `m:ss.cc`; the player and track list use the `'seconds'` precision variant `m:ss`.

### Saving (`submit`)

1. Trim the name; empty → error `Gi partiet et navn`.
2. `endMs <= startMs` → error `Slutttidspunkt må være etter starttidspunkt`.
3. Create (`addBookmark`) or update (`editBookmark(editingBookmark.id, draft)`).
4. Reset the form (cancels a pending preview timer and stops a running preview loop). Returns `true`/`false`.

Editing a bookmark that is currently looping retimes the running loop through the live sync described in doc 03 (no
seek). The editor also resets itself when the track changes or the edited bookmark disappears, and every reset stops a
running preview loop; see the lifecycle section of doc 03.

### Editing an existing bookmark

The pencil button on `BookmarkItem` calls `beginEditing(bookmark)`: the form is replaced with that bookmark's
values, `editingBookmark` is set (heading and button labels switch to "Rediger"/"Oppdater"), and `isDirty` is
false. "Avbryt" and a successful save both return to the empty create state.

## Components

`BookmarkList` renders `sortedBookmarks` for the current track (or a hint when empty) and, in the narrow
layout, the editor underneath. In the wide layout `App.svelte` places the editor separately below the list. All
mutation goes through ViewModel methods; the components contain no persistence or validation logic.
