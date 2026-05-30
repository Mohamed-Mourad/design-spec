import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { configureUi, spinner } from '../src/ui.js'

// Force the interactive (animated) path and capture everything written to
// stderr, so we can assert the spinner animates WITHOUT a clear-to-EOL escape
// (the cause of the watch line flicker on Windows conhost).
describe('ui.spinner (animated, flicker-free)', () => {
  let writes: string[]
  let origWrite: typeof process.stderr.write
  let origTTY: boolean | undefined
  let origCI: string | undefined

  beforeEach(() => {
    writes = []
    origWrite = process.stderr.write
    origTTY = process.stdout.isTTY
    origCI = process.env.CI
    delete process.env.CI
    ;(process.stdout as { isTTY?: boolean }).isTTY = true
    // capture
    ;(process.stderr as unknown as { write: (s: string) => boolean }).write = (s: string) => {
      writes.push(String(s))
      return true
    }
    vi.useFakeTimers()
    configureUi({ json: false, quiet: false, verbose: false })
  })

  afterEach(() => {
    vi.useRealTimers()
    process.stderr.write = origWrite
    ;(process.stdout as { isTTY?: boolean }).isTTY = origTTY
    if (origCI === undefined) delete process.env.CI
    else process.env.CI = origCI
  })

  it('animates frames in place and never clears the whole line', () => {
    const sp = spinner('Watching')
    vi.advanceTimersByTime(300) // ~3 frames
    sp.stop()
    const all = writes.join('')
    expect(writes.length).toBeGreaterThan(1) // it actually animated
    expect(all).toContain('\r') // in-place overwrite
    expect(all).toContain('Watching')
    expect(all).not.toContain('\x1B[2K') // no clear-entire-line
    expect(all).not.toContain('\x1B[0K') // no clear-to-EOL
    expect(all).toContain('\x1B[?25l') // cursor hidden
    expect(all).toContain('\x1B[?25h') // cursor restored on stop
  })

  it('persists a ✓ line on done and keeps animating', () => {
    const sp = spinner('Watching')
    vi.advanceTimersByTime(100)
    sp.done('recompiled 4 file(s) in 3ms')
    vi.advanceTimersByTime(100)
    sp.stop()
    const all = writes.join('')
    expect(all).toContain('recompiled 4 file(s) in 3ms')
    expect(all).toMatch(/✓/)
  })

  it('does not animate when non-interactive (degrades to static logs)', () => {
    ;(process.stdout as { isTTY?: boolean }).isTTY = false
    configureUi({ json: false, quiet: false, verbose: false })
    const sp = spinner('Watching')
    vi.advanceTimersByTime(500)
    sp.done('done')
    const all = writes.join('')
    expect(all).not.toContain('\x1B[?25l') // no cursor-hide, no animation
  })
})
