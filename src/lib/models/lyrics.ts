export interface LyricLine {
  startMs: number | null
  text: string
}

export interface Lyrics {
  synced: boolean
  lines: LyricLine[]
}

const TIMESTAMP_PATTERN = /^\[(\d+):(\d{1,2})(?:[.:](\d{1,3}))?\]\s*(.*)$/

export function parseSyncedLyrics(lrc: string): LyricLine[] {
  const lines: LyricLine[] = []
  for (const rawLine of lrc.split('\n')) {
    const match = TIMESTAMP_PATTERN.exec(rawLine.trim())
    if (!match) continue
    const [, minutes, seconds, fraction = '0', text] = match
    const fractionMs = Number(fraction.padEnd(3, '0'))
    const startMs = (Number(minutes) * 60 + Number(seconds)) * 1000 + fractionMs
    lines.push({ startMs, text })
  }
  return lines.sort((a, b) => a.startMs! - b.startMs!)
}

export function parsePlainLyrics(text: string): LyricLine[] {
  return text.split('\n').map((line) => ({ startMs: null, text: line.trimEnd() }))
}

export function findActiveLineIndex(lyrics: Lyrics | null, positionMs: number): number {
  if (!lyrics?.synced) return -1
  let activeIndex = -1
  for (let i = 0; i < lyrics.lines.length; i++) {
    if (lyrics.lines[i].startMs! > positionMs) break
    activeIndex = i
  }
  return activeIndex
}
