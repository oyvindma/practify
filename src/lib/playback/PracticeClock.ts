import type { LoopRange } from '$lib/playback/LoopEngine'

export interface PracticeClockOptions {
  startMs: number
  loop: LoopRange | null
  trackEndMs: number
  onPosition: (positionMs: number) => void
  onWrap: () => void
  onEnd: () => void
}

export interface IPracticeClock {
  start(options: PracticeClockOptions): void
  setLoop(loop: LoopRange | null): void
  stop(): void
}

const POSITION_INTERVAL_MS = 50

function usableLoop(loop: LoopRange | null): LoopRange | null {
  return loop && loop.endMs > loop.startMs ? loop : null
}

// A song position that advances in real time without Spotify playing. Loop wraps and the end
// of the track fire from an exact timeout so the metronome can restart on the loop start.
export class PracticeClock implements IPracticeClock {
  private options: PracticeClockOptions | null = null
  private anchorPositionMs = 0
  private anchorTimeMs = 0
  private positionTimer: ReturnType<typeof setInterval> | null = null
  private boundaryTimer: ReturnType<typeof setTimeout> | null = null

  constructor(private readonly now: () => number = () => performance.now()) {}

  start(options: PracticeClockOptions): void {
    this.stop()
    this.options = { ...options, loop: usableLoop(options.loop) }
    this.anchorAt(options.startMs)
    options.onPosition(options.startMs)
    this.positionTimer = setInterval(
      () => options.onPosition(this.positionMs()),
      POSITION_INTERVAL_MS,
    )
    this.scheduleBoundary()
  }

  setLoop(loop: LoopRange | null): void {
    if (!this.options) return
    this.anchorAt(this.positionMs())
    this.options = { ...this.options, loop: usableLoop(loop) }
    this.scheduleBoundary()
  }

  stop(): void {
    if (this.positionTimer !== null) clearInterval(this.positionTimer)
    if (this.boundaryTimer !== null) clearTimeout(this.boundaryTimer)
    this.positionTimer = null
    this.boundaryTimer = null
    this.options = null
  }

  private positionMs(): number {
    return this.anchorPositionMs + (this.now() - this.anchorTimeMs)
  }

  private anchorAt(positionMs: number): void {
    this.anchorPositionMs = positionMs
    this.anchorTimeMs = this.now()
  }

  private scheduleBoundary(): void {
    if (this.boundaryTimer !== null) clearTimeout(this.boundaryTimer)
    this.boundaryTimer = null
    const options = this.options
    if (!options) return
    const boundaryMs = options.loop?.endMs ?? (options.trackEndMs > 0 ? options.trackEndMs : null)
    if (boundaryMs === null) return
    const delayMs = Math.max(0, boundaryMs - this.positionMs())
    this.boundaryTimer = setTimeout(() => this.reachBoundary(), delayMs)
  }

  private reachBoundary(): void {
    const options = this.options
    if (!options) return
    if (options.loop) {
      this.anchorAt(options.loop.startMs)
      options.onPosition(options.loop.startMs)
      this.scheduleBoundary()
      options.onWrap()
      return
    }
    this.stop()
    options.onEnd()
  }
}
