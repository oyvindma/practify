import { describe, it, expect, vi, afterEach } from 'vitest'
import { ReccoBeatsBpmService } from '../BpmService'

function stubFetch(status: number, body: unknown = {}) {
  const fetchMock = vi.fn().mockResolvedValue({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => vi.unstubAllGlobals())

describe('ReccoBeatsBpmService', () => {
  it('queries audio features by Spotify track id', async () => {
    const fetchMock = stubFetch(200, { content: [] })
    await new ReccoBeatsBpmService().getBpm('abc123')
    const url = new URL(fetchMock.mock.calls[0][0])
    expect(url.pathname).toBe('/v1/audio-features')
    expect(url.searchParams.get('ids')).toBe('abc123')
  })

  it('returns the tempo', async () => {
    stubFetch(200, { content: [{ tempo: 171.001 }] })
    expect(await new ReccoBeatsBpmService().getBpm('x')).toBe(171.001)
  })

  it('returns null when the track is unknown or has no usable tempo', async () => {
    stubFetch(200, { content: [] })
    expect(await new ReccoBeatsBpmService().getBpm('x')).toBeNull()
    stubFetch(200, { content: [{ tempo: 0 }] })
    expect(await new ReccoBeatsBpmService().getBpm('x')).toBeNull()
  })

  it('throws on HTTP errors', async () => {
    stubFetch(429)
    await expect(new ReccoBeatsBpmService().getBpm('x')).rejects.toThrow('429')
  })
})
