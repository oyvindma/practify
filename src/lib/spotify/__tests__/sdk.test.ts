import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('loadSpotifySDK', () => {
  beforeEach(() => {
    vi.resetModules()
    document.body.innerHTML = ''
    delete (window as { Spotify?: unknown }).Spotify
  })

  const scriptTag = () => document.querySelector('script[src*="sdk.scdn.co"]') as HTMLScriptElement

  it('resolves when the SDK announces it is ready', async () => {
    const { loadSpotifySDK } = await import('../sdk')
    const promise = loadSpotifySDK()
    window.onSpotifyWebPlaybackSDKReady()
    await expect(promise).resolves.toBeUndefined()
  })

  it('injects the script only once', async () => {
    const { loadSpotifySDK } = await import('../sdk')
    void loadSpotifySDK()
    void loadSpotifySDK()
    expect(document.querySelectorAll('script[src*="sdk.scdn.co"]')).toHaveLength(1)
  })

  it('rejects when the script fails to load and retries on the next call', async () => {
    const { loadSpotifySDK } = await import('../sdk')
    const first = loadSpotifySDK()
    scriptTag().onerror?.(new Event('error'))
    await expect(first).rejects.toThrow('Could not load')
    expect(scriptTag()).toBeNull()

    const second = loadSpotifySDK()
    expect(scriptTag()).not.toBeNull()
    window.onSpotifyWebPlaybackSDKReady()
    await expect(second).resolves.toBeUndefined()
  })
})
