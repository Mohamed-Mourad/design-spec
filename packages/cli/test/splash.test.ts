import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { configureUi, splash } from '../src/ui.js'
import { runCli, tmpProject, cleanup } from './helpers'

describe('ui.splash (rendered)', () => {
  let writes: string[]
  let origWrite: typeof process.stdout.write
  let origTTY: boolean | undefined
  let origCI: string | undefined

  beforeEach(() => {
    writes = []
    origWrite = process.stdout.write
    origTTY = process.stdout.isTTY
    origCI = process.env.CI
    delete process.env.CI
    process.env.FORCE_COLOR = '1'
    ;(process.stdout as { isTTY?: boolean; columns?: number }).isTTY = true
    ;(process.stdout as { columns?: number }).columns = 100
    ;(process.stdout as unknown as { write: (s: string) => boolean }).write = (s: string) => {
      writes.push(String(s))
      return true
    }
    configureUi({})
  })

  afterEach(() => {
    process.stdout.write = origWrite
    ;(process.stdout as { isTTY?: boolean }).isTTY = origTTY
    if (origCI === undefined) delete process.env.CI
    else process.env.CI = origCI
    delete process.env.FORCE_COLOR
  })

  it('renders the block wordmark, tip, version, cwd, and hints', () => {
    splash({ version: '9.9.9', cwd: '/x/y', tip: 'TIP-LINE', status: 'STATUS-LINE', hints: 'HINTS-LINE' })
    const all = writes.join('')
    expect(all).toContain('█') // block wordmark
    expect(all).toContain('TIP-LINE')
    expect(all).toContain('9.9.9')
    expect(all).toContain('/x/y')
    expect(all).toContain('STATUS-LINE')
    expect(all).toContain('HINTS-LINE')
  })

  it('suppresses the splash entirely in --json mode', () => {
    configureUi({ json: true })
    splash({ version: '1', cwd: '/x', tip: 't', status: 's', hints: 'h' })
    expect(writes.join('')).toBe('')
  })
})

describe('bare invocation', () => {
  let dir: string
  beforeEach(async () => {
    dir = await tmpProject()
  })
  afterEach(async () => {
    await cleanup(dir)
  })

  it('prints plain help (no block art) and exits 0 when piped', async () => {
    const r = await runCli([], dir)
    expect(r.code).toBe(0)
    expect(r.stdout).toContain('Usage: design-spec')
    expect(r.stdout).not.toContain('█') // no splash art when non-TTY
  })
})
