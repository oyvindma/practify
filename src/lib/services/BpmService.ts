export interface IBpmService {
  getBpm(spotifyTrackId: string): Promise<number | null>
}

interface ReccoBeatsAudioFeatures {
  content: { tempo?: number }[]
}

const RECCOBEATS_AUDIO_FEATURES_URL = 'https://api.reccobeats.com/v1/audio-features'

// Spotify's own audio-features endpoint returns 403 for apps created after 2024-11-27.
export class ReccoBeatsBpmService implements IBpmService {
  async getBpm(spotifyTrackId: string): Promise<number | null> {
    const params = new URLSearchParams({ ids: spotifyTrackId })
    const response = await fetch(`${RECCOBEATS_AUDIO_FEATURES_URL}?${params}`)
    if (!response.ok) throw new Error(`ReccoBeats responded with ${response.status}`)

    const features = (await response.json()) as ReccoBeatsAudioFeatures
    const tempo = features.content[0]?.tempo
    return typeof tempo === 'number' && tempo > 0 ? tempo : null
  }
}
