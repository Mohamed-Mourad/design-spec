import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { runCli, tmpProject, cleanup, seedReactTailwind } from './helpers'
import { startWatch } from '../src/commands/watch.js'

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
