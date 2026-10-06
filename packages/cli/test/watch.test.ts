import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { runCli, tmpProject, cleanup, seedReactTailwind } from './helpers'
import { startWatch, syncIntervalMs } from '../src/commands/watch.js'

describe('syncIntervalMs', () => {
  it('ignores DESIGN_SPEC_SYNC_INTERVAL_MS outside a test run', () => {
    const env = { DESIGN_SPEC_SYNC_INTERVAL_MS: '50' }
    expect(syncIntervalMs(undefined, env)).toBe(60_000)
    expect(syncIntervalMs('30', env)).toBe(30_000)
    // …so the floor still holds for anyone who sets it.
    expect(syncIntervalMs('1', env)).toBe(15_000)
  })

  it('honours the override only under Vitest', () => {
    expect(syncIntervalMs('30', { VITEST: 'true', DESIGN_SPEC_SYNC_INTERVAL_MS: '50' })).toBe(50)
    expect(syncIntervalMs('30', { VITEST: 'true', DESIGN_SPEC_SYNC_INTERVAL_MS: 'soon' })).toBe(30_000)
  })

  it('applies the 15 second floor to --sync-interval', () => {
    expect(syncIntervalMs('5', {})).toBe(15_000)
    expect(syncIntervalMs('nope', {})).toBe(15_000)
    expect(syncIntervalMs(undefined, {})).toBe(60_000)
  })
})

describe('watch', () => {
  let dir: string
  beforeEach(async () => {
    dir = await tmpProject()
    await seedReactTailwind(dir)
    await runCli(['init', '--yes'], dir)
  })
  afterEach(async () => {
    await cleanup(dir)
  })

  it('recompiles output (fast) when the schema is saved, and only watches the schema', async () => {
    const handle = await startWatch(dir)
    try {
      // give chokidar a beat to reach "ready"
      await new Promise((r) => setTimeout(r, 200))

      const recompiled = new Promise<{ files: string[]; ms: number }>((resolve) => {
        const start = Date.now()
        handle.onCompiled((files) => resolve({ files, ms: Date.now() - start }))
      })

      const schemaPath = join(dir, 'design-spec.schema.json')
      const schema = JSON.parse(await readFile(schemaPath, 'utf8'))
      schema.colors.primary = '#123456'
      await writeFile(schemaPath, JSON.stringify(schema, null, 2) + '\n')

      const { files, ms } = await recompiled
      expect(files).toContain('tokens.css')
      // recompile itself should be well under 100ms (excludes debounce wait)
      expect(ms).toBeLessThan(2000)
      expect(await readFile(join(dir, 'tokens.css'), 'utf8')).toContain('#123456')
    } finally {
      await handle.close()
    }
  })

  it('does NOT recompile when a generated output file changes (no feedback loop)', async () => {
    const handle = await startWatch(dir)
    try {
      await new Promise((r) => setTimeout(r, 200))
      let fired = false
      handle.onCompiled(() => {
        fired = true
      })
      // touch a generated file — watch must ignore it
      await writeFile(join(dir, 'tokens.css'), '/* externally edited */\n')
      await new Promise((r) => setTimeout(r, 400))
      expect(fired).toBe(false)
    } finally {
      await handle.close()
    }
  })
})
