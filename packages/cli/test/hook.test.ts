import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { runCli, tmpProject, cleanup, seedReactTailwind } from './helpers'

describe('hook', () => {
  let dir: string
  beforeEach(async () => {
    dir = await tmpProject()
    await seedReactTailwind(dir)
    await mkdir(join(dir, '.git', 'hooks'), { recursive: true }) // fake git repo
    await runCli(['init', '--yes'], dir)
  })
  afterEach(async () => {
    await cleanup(dir)
  })

  it('install writes an executable pre-commit hook', async () => {
    const r = await runCli(['hook', 'install'], dir)
    expect(r.code).toBe(0)
    const hookPath = join(dir, '.git', 'hooks', 'pre-commit')
    expect(existsSync(hookPath)).toBe(true)
    expect(await readFile(hookPath, 'utf8')).toContain('design-spec hook run')
  })

  it('install never clobbers an existing developer hook', async () => {
    const hookPath = join(dir, '.git', 'hooks', 'pre-commit')
    await writeFile(hookPath, '#!/bin/sh\necho "my own check"\n')
    await runCli(['hook', 'install'], dir)
    const content = await readFile(hookPath, 'utf8')
    expect(content).toContain('my own check')
    expect(content).toContain('design-spec hook run')
  })

  it('hook run recompiles stale output and reports it', async () => {
    await writeFile(join(dir, 'tokens.css'), '/* stale */\n')
    const r = await runCli(['hook', 'run', '--json'], dir)
    expect(r.code).toBe(0)
    expect(JSON.parse(r.stdout).staged.length).toBeGreaterThan(0)
    // output is regenerated
    expect(await readFile(join(dir, 'tokens.css'), 'utf8')).toContain('--color-primary')
  })

  it('hook run blocks (non-zero) on an invalid schema', async () => {
    await writeFile(join(dir, 'design-spec.schema.json'), JSON.stringify({ name: 'x' }))
    const r = await runCli(['hook', 'run'], dir)
    expect(r.code).not.toBe(0)
  })
})
