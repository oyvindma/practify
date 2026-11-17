export interface IMetronomeService {
  // Without a delay the first click comes right away; with one, clicks sit on a beat grid that
  // has a beat `firstClickDelayMs` from now
  start(bpm: number, firstClickDelayMs?: number): void
  setBpm(bpm: number): void
  stop(): void
}

const SCHEDULER_INTERVAL_MS = 25
const LOOKAHEAD_SECONDS = 0.1
const START_DELAY_SECONDS = 0.05
const CLICK_FREQUENCY_HZ = 1000
const CLICK_DURATION_SECONDS = 0.05

// Clicks are scheduled ahead on the audio clock, so timer jitter doesn't affect the beat.
export class WebAudioMetronomeService implements IMetronomeService {
  private context: AudioContext | null = null
  private schedulerTimer: ReturnType<typeof setInterval> | null = null
  private nextClickTime = 0
  private bpm = 120
  private pendingClicks = new Set<OscillatorNode>()

  start(bpm: number, firstClickDelayMs?: number): void {
    this.stop()
    this.bpm = bpm
    this.context ??= new AudioContext()
    void this.context.resume()
    const leadSeconds =
      firstClickDelayMs === undefined
        ? START_DELAY_SECONDS
        : this.leadOnBeatGrid(firstClickDelayMs, bpm)
    this.nextClickTime = this.context.currentTime + leadSeconds
    this.schedulerTimer = setInterval(() => this.scheduleClicks(), SCHEDULER_INTERVAL_MS)
    this.scheduleClicks()
  }

  setBpm(bpm: number): void {
    this.bpm = bpm
  }

  stop(): void {
    if (this.schedulerTimer !== null) clearInterval(this.schedulerTimer)
    this.schedulerTimer = null
    // Clicks already scheduled ahead would otherwise sound after a restart or realignment
    for (const oscillator of this.pendingClicks) {
      try {
        oscillator.stop()
      } catch {
        // Already stopped
      }
    }
    this.pendingClicks.clear()
  }

  // A beat that is too close to be scheduled is skipped, never moved: moving it would shift
  // the whole grid by up to START_DELAY_SECONDS
  private leadOnBeatGrid(delayMs: number, bpm: number): number {
    const beatMs = 60_000 / bpm
    let leadMs = delayMs
    while (leadMs < START_DELAY_SECONDS * 1000) leadMs += beatMs
    return leadMs / 1000
  }

  private scheduleClicks(): void {
    const context = this.context
    if (!context) return
    while (this.nextClickTime < context.currentTime + LOOKAHEAD_SECONDS) {
      this.scheduleClick(context, this.nextClickTime)
      this.nextClickTime += 60 / this.bpm
    }
  }

  private scheduleClick(context: AudioContext, time: number): void {
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.frequency.value = CLICK_FREQUENCY_HZ
    gain.gain.setValueAtTime(1, time)
    gain.gain.exponentialRampToValueAtTime(0.001, time + CLICK_DURATION_SECONDS)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.onended = () => this.pendingClicks.delete(oscillator)
    this.pendingClicks.add(oscillator)
    oscillator.start(time)
    oscillator.stop(time + CLICK_DURATION_SECONDS)
  }
}
