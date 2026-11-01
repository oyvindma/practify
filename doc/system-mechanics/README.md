# System mechanics

Technical documentation of how Practify works internally. Read in this order:

| Document | Covers |
| --- | --- |
| [01-architecture.md](01-architecture.md) | Layers (model / service / ViewModel / view), composition root, startup, dependency graph |
| [02-player-and-state.md](02-player-and-state.md) | Spotify player integration, `PlayerState`, how position is tracked, polling, commands |
| [03-loop-playback.md](03-loop-playback.md) | How a bookmark is played in a loop, activation, the 100 ms loop engine, live re-sync, previews |
| [04-bookmarks.md](04-bookmarks.md) | Bookmark data model, persistence, track scoping, the editor ViewModel |
| [05-auth-and-spotify-api.md](05-auth-and-spotify-api.md) | PKCE login, token storage and refresh, Web API usage |

Conventions used throughout: all times are **milliseconds** with an `Ms` suffix; UI display format is `m:ss.cs`
(for example `3:17.45`). "Store" means a Svelte `Readable` store exposed by a ViewModel.
Code is referenced by file and function name.
