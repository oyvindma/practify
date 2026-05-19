/**
 * Formats milliseconds as m:ss.cs (e.g. 197450 → "3:17.45") by default,
 * or as m:ss (e.g. "3:17") when precision is 'seconds'.
 */
export function formatMs(ms: number, precision: 'centiseconds' | 'seconds' = 'centiseconds'): string {
  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  if (precision === 'seconds') {
    return `${min}:${sec.toString().padStart(2, '0')}`
  }
  const centisec = Math.floor((ms % 1000) / 10)
  return `${min}:${sec.toString().padStart(2, '0')}.${centisec.toString().padStart(2, '0')}`
}

/**
 * Parses m:ss.cs (with optional leading zeros, 1–2 digit fields).
 * Centiseconds are right-padded: ".4" → 40cs = 400 ms, ".04" → 4cs = 40 ms.
 * Returns null on invalid input.
 */
export function parseMs(value: string): number | null {
  const match = value.trim().match(/^(\d+):(\d{1,2})\.(\d{1,2})$/)
  if (!match) return null
  const sec = parseInt(match[2])
  const cs = parseInt(match[3].padEnd(2, '0'))
  if (sec >= 60 || cs >= 100) return null
  return (parseInt(match[1]) * 60 + sec) * 1000 + cs * 10
}

/**
 * Adjusts a millisecond value by delta, clamped so the result never goes below 0.
 */
export function adjustMs(currentMs: number, delta: number): number {
  return Math.max(0, currentMs + delta)
}
