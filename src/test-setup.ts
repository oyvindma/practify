import { vi } from 'vitest'

class MemoryStorage implements Storage {
  private entries = new Map<string, string>()

  get length() {
    return this.entries.size
  }

  clear() {
    this.entries.clear()
  }

  getItem(key: string) {
    return this.entries.get(key) ?? null
  }

  key(index: number) {
    return [...this.entries.keys()][index] ?? null
  }

  removeItem(key: string) {
    this.entries.delete(key)
  }

  setItem(key: string, value: string) {
    this.entries.set(key, String(value))
  }
}

// Newer Node versions ship an experimental global localStorage that shadows jsdom's
// and is undefined unless --localstorage-file is given.
if (typeof localStorage === 'undefined') {
  vi.stubGlobal('localStorage', new MemoryStorage())
}
if (typeof sessionStorage === 'undefined') {
  vi.stubGlobal('sessionStorage', new MemoryStorage())
}
