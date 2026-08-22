import { beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// jsdom's default (opaque) origin gives a non-functional localStorage; provide a
// deterministic in-memory shim so the store's persistence layer works in tests.
class MemoryStorage implements Storage {
  private map = new Map<string, string>()
  get length() {
    return this.map.size
  }
  clear() {
    this.map.clear()
  }
  getItem(key: string) {
    return this.map.has(key) ? this.map.get(key)! : null
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null
  }
  removeItem(key: string) {
    this.map.delete(key)
  }
  setItem(key: string, value: string) {
    this.map.set(key, String(value))
  }
}

if (typeof globalThis.localStorage === 'undefined' || typeof globalThis.localStorage.clear !== 'function') {
  Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true })
}

// Fresh Pinia + clean storage per test so the store starts from defaultSchema.
beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})
