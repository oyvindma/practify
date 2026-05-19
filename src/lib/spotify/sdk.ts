declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady: () => void
    Spotify: typeof Spotify
  }
}

let sdkReadyPromise: Promise<void> | null = null

/**
 * Injects the Spotify Web Playback SDK script and resolves once the SDK is
 * ready. Safe to call multiple times — subsequent calls return the same promise.
 */
export function loadSpotifySDK(): Promise<void> {
  if (sdkReadyPromise) return sdkReadyPromise

  sdkReadyPromise = new Promise((resolve) => {
    if (typeof window.Spotify !== 'undefined') {
      resolve()
      return
    }

    const prev = window.onSpotifyWebPlaybackSDKReady
    window.onSpotifyWebPlaybackSDKReady = () => {
      prev?.()
      resolve()
    }

    const script = document.createElement('script')
    script.src = 'https://sdk.scdn.co/spotify-player.js'
    script.async = true
    document.body.appendChild(script)
  })

  return sdkReadyPromise
}
