import type { PlaybackSnapshot } from '$lib/services/SpotifyPlayerService'

const PROGRESS_POLL_INTERVAL_MS = 500
const LOOP_POLL_INTERVAL_MS = 100

export interface LoopRange {
  startMs: number
  endMs: number
}

export interface PlaybackSource {
  getPlaybackSnapshot(): Promise<PlaybackSnapshot | null>
  seek(positionMs: number): Promise<void>
}

export class LoopEngine {
  private progressIntervalId: ReturnType<typeof setInterval> | null = null
  private loopTimeoutId: ReturnType<typeof setTimeout> | null = null
  private loop: LoopRange | null = null
  private isPlaying = false
  private isSeekInFlight = false
  private loopRunId = 0

  constructor(
    private readonly source: PlaybackSource,
    private readonly onPosition: (positionMs: number) => void,
  ) {}

  get isLooping(): boolean {
    return this.loop !== null
  }

  setPlaying(isPlaying: boolean): void {
    this.isPlaying = isPlaying
    this.syncProgressPolling()
  }

  startLoop(range: LoopRange, startFromMs: number = range.startMs): void {
    this.cancelLoopTimer()
    this.loop = { ...range }
    this.loopRunId++
    this.syncProgressPolling()
    this.seekTo(startFromMs)
    this.scheduleLoopTick(this.loopRunId, 0)
  }

  updateLoop(range: LoopRange): void {
    if (this.loop) this.loop = { ...range }
  }

  stopLoop(): void {
    this.cancelLoopTimer()
    this.loop = null
    this.loopRunId++
    this.syncProgressPolling()
  }

  dispose(): void {
    this.stopLoop()
    this.isPlaying = false
    this.syncProgressPolling()
  }

  private syncProgressPolling(): void {
    const shouldPoll = this.isPlaying && this.loop === null
    if (shouldPoll && this.progressIntervalId === null) {
      this.progressIntervalId = setInterval(
        () => void this.pollProgress(),
        PROGRESS_POLL_INTERVAL_MS,
      )
    } else if (!shouldPoll && this.progressIntervalId !== null) {
      clearInterval(this.progressIntervalId)
      this.progressIntervalId = null
    }
  }

  private async pollProgress(): Promise<void> {
    const snapshot = await this.source.getPlaybackSnapshot()
    if (snapshot && !snapshot.isPaused) this.onPosition(snapshot.positionMs)
  }

  private scheduleLoopTick(runId: number, delayMs: number): void {
    this.loopTimeoutId = setTimeout(() => void this.loopTick(runId), delayMs)
  }

  private isCurrentRun(runId: number): boolean {
    return runId === this.loopRunId && this.loop !== null
  }

  private async loopTick(runId: number): Promise<void> {
    const snapshot = await this.source.getPlaybackSnapshot()
    if (!this.isCurrentRun(runId)) return

    if (snapshot) {
      this.onPosition(snapshot.positionMs)
      const { startMs, endMs } = this.loop!
      const hasReachedEnd = snapshot.positionMs >= endMs
      if (hasReachedEnd && !snapshot.isPaused && !this.isSeekInFlight) this.seekTo(startMs)
    }
    this.scheduleLoopTick(runId, LOOP_POLL_INTERVAL_MS)
  }

  private cancelLoopTimer(): void {
    if (this.loopTimeoutId === null) return
    clearTimeout(this.loopTimeoutId)
    this.loopTimeoutId = null
  }

  private seekTo(positionMs: number): void {
    this.isSeekInFlight = true
    this.source
      .seek(positionMs)
      .catch((error) => console.warn('[loop] seek failed', error))
      .finally(() => {
        this.isSeekInFlight = false
      })
  }
}
