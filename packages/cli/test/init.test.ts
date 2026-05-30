import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { runCli, tmpProject, cleanup, seedReactTailwind } from './helpers'

describe('design-spec init', () => {
  let dir: string
  beforeEach(async () => {
    dir = await tmpProject()
  })
  afterEach(async () => {
    await cleanup(dir)
  })

  it('synthesizes schema + DESIGN.md + SKILL.md in a react/tailwind project, fast', async () => {
    await seedReactTailwind(dir)
    const start = Date.now()
    const r = await runCli(['init', '--yes'], dir)
    const elapsed = Date.now() - start

    expect(r.code).toBe(0)
    expect(existsSync(join(dir, 'design-spec.schema.json'))).toBe(true)
    expect(existsSync(join(dir, 'DESIGN.md'))).toBe(true)
    expect(existsSync(join(dir, 'SKILL.md'))).toBe(true)
    expect(existsSync(join(dir, 'tailwind.config.js'))).toBe(true)
    expect(existsSync(join(dir, 'tokens.css'))).toBe(true)
    // Allow generous headroom over the <3s target for a cold spawn in CI.
    expect(elapsed).toBeLessThan(8000)
  })

  it('shows banner → task list → boxed summary in a human run', async () => {
    await seedReactTailwind(dir)
    const r = await runCli(['init', '--yes'], dir, { FORCE_COLOR: '1' })
    expect(r.stdout).toContain('design-spec') // banner
    expect(r.stdout).toMatch(/Detecting framework/) // task list
    expect(r.stdout).toMatch(/Next steps:/) // boxed summary
  })

  it('lifts scanned tokens into the schema (the brand color from tailwind.config.js)', async () => {
    await seedReactTailwind(dir)
    await runCli(['init', '--yes'], dir)
    const schema = JSON.parse(await readFile(join(dir, 'design-spec.schema.json'), 'utf8'))
    expect(schema.colors.brand).toBe('#FF5733')
  })

  it('--json emits a clean machine result and no decoration', async () => {
    await seedReactTailwind(dir)
    const r = await runCli(['init', '--yes', '--json'], dir)
    expect(r.code).toBe(0)
    const parsed = JSON.parse(r.stdout)
    expect(parsed.ok).toBe(true)
    expect(parsed.written).toContain('design-spec.schema.json')
    expect(r.stdout).not.toContain('Next steps') // no boxed summary in json mode
  })

  it('refuses to clobber an existing schema without --force', async () => {
    await seedReactTailwind(dir)
    await runCli(['init', '--yes'], dir)
    const r = await runCli(['init', '--yes'], dir)
    expect(r.code).not.toBe(0)
    expect(r.stderr).toMatch(/already exists/)
  })

  it('injects the managed block into an existing .cursorrules without clobbering it', async () => {
    await seedReactTailwind(dir)
    await writeFile(join(dir, '.cursorrules'), 'MY EXISTING RULE\nkeep me\n')
    await runCli(['init', '--yes'], dir)
    const rules = await readFile(join(dir, '.cursorrules'), 'utf8')
    expect(rules).toContain('MY EXISTING RULE') // preserved
    expect(rules).toContain('DESIGN-SPEC START')
    expect(rules).toContain('design-spec.schema.json is the design-token source of truth')
  })

  it('re-running init rewrites only the managed block, leaving developer rules intact', async () => {
    await seedReactTailwind(dir)
    await writeFile(join(dir, '.cursorrules'), 'MY EXISTING RULE\n')
    await runCli(['init', '--yes'], dir)
    await runCli(['init', '--yes', '--force'], dir)
    const rules = await readFile(join(dir, '.cursorrules'), 'utf8')
    // exactly one managed block
    expect(rules.match(/DESIGN-SPEC START/g)?.length).toBe(1)
    expect(rules).toContain('MY EXISTING RULE')
  })
})
