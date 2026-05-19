# Spotify Practice Tool 🎸

En nettapp for musikere som vil øve mer effektivt med Spotify. Registrer **partier** (bookmarks) i låter med start- og sluttidspunkt, og la appen loope dem automatisk, uten manuell spoling.

## Funksjoner

- 🔐 Innlogging via Spotify OAuth 2.0 (PKCE – ingen backend nødvendig)
- 🎵 Bla gjennom dine Spotify-spillelister og velg låter
- ▶️ Avspilling direkte i nettleseren via Spotify Web Playback SDK
- 🔁 Registrer partier per låt med navn, start- og sluttidspunkt
- 📌 Aktiver en loop med ett klikk – appen spoler automatisk tilbake ved slutten
- 💾 Partier lagres lokalt i nettleseren (localStorage)

## Forutsetninger

- **Spotify Premium**-konto (kreves av Web Playback SDK)
- Node.js 20+ og npm

## Kom i gang

### 1. Registrer en Spotify-app

1. Gå til [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Klikk **Create app**
3. Fyll inn et navn og en beskrivelse
4. Under **Redirect URIs**, legg til: `http://localhost:5173/callback`
5. Kopi `Client ID` fra appens oversikt

### 2. Konfigurer miljøvariabler

```bash
cp .env.example .env
```

Åpne `.env` og fyll inn:

```
VITE_SPOTIFY_CLIENT_ID=din_client_id_her
VITE_REDIRECT_URI=http://localhost:5173/callback
```

### 3. Installer og start

```bash
npm install
npm run dev
```

Åpne [http://localhost:5173](http://localhost:5173) i nettleseren.

## Utvikling

```bash
npm run dev        # Start utviklingsserver
npm test           # Kjør tester (Vitest)
npm run test:watch # Kjør tester i watch-modus
npm run build      # Bygg for produksjon
npm run lint       # Lint kildekoden
npm run format     # Formater kildekoden
```

## Deployment til GitHub Pages

Appen deployes automatisk til [https://oyvindma.github.io/practify/](https://oyvindma.github.io/practify/) når du pusher til `prod`-branchen.

### Engangskonfigurasjon

#### 1. Aktiver GitHub Pages

Gå til **Settings → Pages** i GitHub-repoet og sett source til **GitHub Actions**.

#### 2. Legg til GitHub-hemmeligheter

Gå til **Settings → Secrets and variables → Actions** og legg til:

| Navn | Verdi |
|------|-------|
| `VITE_SPOTIFY_CLIENT_ID` | Din Spotify Client ID |

#### 3. Legg til redirect URI i Spotify Dashboard

Gå til [Spotify Developer Dashboard](https://developer.spotify.com/dashboard), åpne appen din og legg til følgende under **Redirect URIs**:

```
https://oyvindma.github.io/practify/callback
```

#### Sikkerhetsmerk om Client ID

`VITE_SPOTIFY_CLIENT_ID` blir bakt inn i JavaScript-bunderen og er synlig for alle som bruker DevTools. Dette er standard og forventet oppførsel for nettapper som bruker PKCE-flyten – det finnes ingen `client_secret` i en SPA. Hemmeligheten i GitHub hindrer at verdien havner i git-historikken.

## Teknologi

- [Svelte 5](https://svelte.dev) + [Vite](https://vite.dev) + TypeScript
- [Tailwind CSS 4](https://tailwindcss.com)
- [Spotify Web API](https://developer.spotify.com/documentation/web-api)
- [Spotify Web Playback SDK](https://developer.spotify.com/documentation/web-playback-sdk)
- [Vitest](https://vitest.dev) for testing
