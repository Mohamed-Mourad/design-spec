import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { runCli, tmpProject, cleanup, seedReactTailwind } from './helpers'

async function initProject(dir: string): Promise<void> {
  await seedReactTailwind(dir)
  await runCli(['init', '--yes'], dir)
}

describe('compile / lint / status', () => {
  let dir: string
  beforeEach(async () => {
    dir = await tmpProject()
    await initProject(dir)
  })
  afterEach(async () => {
    await cleanup(dir)
  })

  it('compile is idempotent — a fresh compile leaves lint clean', async () => {
    const r = await runCli(['compile'], dir)
    expect(r.code).toBe(0)
    const lint = await runCli(['lint'], dir)
    expect(lint.code).toBe(0)
  })

  it('lint fails with the stale-output exit code when output drifts', async () => {
    await writeFile(join(dir, 'tokens.css'), '/* hand-edited, now stale */\n')
    const r = await runCli(['lint'], dir)
    expect(r.code).toBe(5) // ExitCode.STALE_OUTPUT
  })

  it('lint fails with the invalid-schema exit code on a broken schema', async () => {
    await writeFile(join(dir, 'design-spec.schema.json'), JSON.stringify({ name: 'x' }))
    const r = await runCli(['lint'], dir)
    expect(r.code).toBe(4) // ExitCode.INVALID_SCHEMA
  })

  it('status --json | cat yields clean JSON with no color or spinner artifacts', async () => {
    const r = await runCli(['status', '--json'], dir, { NO_COLOR: '1' })
    expect(r.code).toBe(0)
    // The entire stdout must parse as JSON — no banner/spinner/ansi leakage.
    const parsed = JSON.parse(r.stdout)
    expect(parsed.ok).toBe(true)
    expect(parsed.frameworks).toContain('react-tailwind')
    // eslint-disable-next-line no-control-regex
    expect(r.stdout).not.toMatch(/\[/) // no ANSI escape codes
  })

  it('status in an uninitialized dir fails with the not-initialized code', async () => {
    const empty = await tmpProject()
    try {
      const r = await runCli(['status'], empty)
      expect(r.code).toBe(3) // ExitCode.NOT_INITIALIZED
      expect(r.stderr).toMatch(/design-spec init/)
    } finally {
      await cleanup(empty)
    }
  })
})

describe('fix', () => {
  let dir: string
  beforeEach(async () => {
    dir = await tmpProject()
    await initProject(dir)
  })
  afterEach(async () => {
    await cleanup(dir)
  })

  it('rewrites an arbitrary Tailwind class to a token class in place', async () => {
    const file = join(dir, 'src', 'Hero.tsx')
    await writeFile(file, 'export const Hero = () => <div className="text-[#2563EB]">hi</div>\n')
    const r = await runCli(['fix'], dir)
    expect(r.code).toBe(0)
    expect(await readFile(file, 'utf8')).toContain('text-primary')
  })

  it('--dry-run/--plan previews the change without writing', async () => {
    const file = join(dir, 'src', 'Hero.tsx')
    const original = 'const c = "#2563EB"\n'
    await writeFile(file, original)
    const r = await runCli(['fix', '--dry-run', '--json'], dir)
    expect(r.code).toBe(0)
    const out = JSON.parse(r.stdout)
    expect(out.plan).toBe(true)
    expect(out.changes.some((c: { path: string }) => c.path.endsWith('src/Hero.tsx'))).toBe(true)
    expect(await readFile(file, 'utf8')).toBe(original) // untouched
  })

  it('never rewrites its own generated output (tokens.css / tailwind.config.js / components)', async () => {
    // init already compiled these — their raw hex/px are token definitions, not drift.
    const tokensBefore = await readFile(join(dir, 'tokens.css'), 'utf8')
    const configBefore = await readFile(join(dir, 'tailwind.config.js'), 'utf8')
    const buttonBefore = await readFile(join(dir, 'components', 'Button.tsx'), 'utf8')

    // a real drift file the fixer SHOULD touch
    const src = join(dir, 'src', 'Hero.tsx')
    await writeFile(src, 'const c = "#2563EB"\n')

    const r = await runCli(['fix', '--json'], dir)
    expect(r.code).toBe(0)
    const fixedFiles = JSON.parse(r.stdout).files.map((f: { file: string }) => f.file)

    // generated files untouched and never reported as fixed
    expect(await readFile(join(dir, 'tokens.css'), 'utf8')).toBe(tokensBefore)
    expect(await readFile(join(dir, 'tailwind.config.js'), 'utf8')).toBe(configBefore)
    expect(await readFile(join(dir, 'components', 'Button.tsx'), 'utf8')).toBe(buttonBefore)
    expect(fixedFiles).not.toContain('tokens.css')
    expect(fixedFiles).not.toContain('tailwind.config.js')
    // the genuine drift was still fixed
    expect(await readFile(src, 'utf8')).toContain('var(--color-primary)')
  })
})

describe('plan (--plan / --dry-run)', () => {
  let dir: string
  beforeEach(async () => {
    dir = await tmpProject()
  })
  afterEach(async () => {
    await cleanup(dir)
  })

  it('init --plan previews creates and writes nothing', async () => {
    await seedReactTailwind(dir)
    const r = await runCli(['init', '--yes', '--plan', '--json'], dir)
    expect(r.code).toBe(0)
    const out = JSON.parse(r.stdout)
    expect(out.plan).toBe(true)
    expect(out.changes.some((c: { path: string; kind: string }) => c.path.endsWith('design-spec.schema.json') && c.kind === 'create')).toBe(true)
    // nothing was actually written
    expect(existsSync(join(dir, 'design-spec.schema.json'))).toBe(false)
    expect(existsSync(join(dir, 'DESIGN.md'))).toBe(false)
  })

  it('compile --plan shows a diff and leaves output untouched', async () => {
    await initProject(dir)
    // make the schema differ from compiled output
    const schemaPath = join(dir, 'design-spec.schema.json')
    const schema = JSON.parse(await readFile(schemaPath, 'utf8'))
    schema.name = 'Renamed System'
    await writeFile(schemaPath, JSON.stringify(schema, null, 2) + '\n')
    const before = await readFile(join(dir, 'DESIGN.md'), 'utf8')

    const human = await runCli(['compile', '--plan'], dir)
    expect(human.code).toBe(0)
    expect(human.stdout).toMatch(/Plan:/)
    expect(human.stdout).toMatch(/DESIGN\.md/)

    // DESIGN.md on disk is unchanged (still the old name)
    expect(await readFile(join(dir, 'DESIGN.md'), 'utf8')).toBe(before)
  })
})

describe('config', () => {
  let dir: string
  beforeEach(async () => {
    dir = await tmpProject()
    await initProject(dir)
  })
  afterEach(async () => {
    await cleanup(dir)
  })

  it('--list prints the current export config as JSON', async () => {
    const r = await runCli(['config', '--list', '--json'], dir)
    expect(r.code).toBe(0)
    expect(JSON.parse(r.stdout).export.frameworks).toContain('react-tailwind')
  })

  it('config set updates a key and recompiles', async () => {
    const r = await runCli(['config', 'set', 'cssVariablePrefix', 'ds-'], dir)
    expect(r.code).toBe(0)
    const schema = JSON.parse(await readFile(join(dir, 'design-spec.schema.json'), 'utf8'))
    expect(schema.export.cssVariablePrefix).toBe('ds-')
    expect(await readFile(join(dir, 'tokens.css'), 'utf8')).toContain('--ds-color-primary')
  })

  it('non-TTY config without flags keeps current values (never hangs)', async () => {
    const r = await runCli(['config', '--json'], dir)
    expect(r.code).toBe(0)
    expect(JSON.parse(r.stdout).ok).toBe(true)
  })
})

describe('sync / push stubs', () => {
  let dir: string
  beforeEach(async () => {
    dir = await tmpProject()
    await initProject(dir)
  })
  afterEach(async () => {
    await cleanup(dir)
  })

  it('sync fails cleanly with the not-implemented code and an actionable hint', async () => {
    const r = await runCli(['sync', '--key', 'ds_live_x'], dir)
    expect(r.code).toBe(7) // ExitCode.NOT_IMPLEMENTED
    expect(r.stderr).toMatch(/account/i)
    expect(r.stderr).not.toMatch(/at Object|node:internal/) // no raw stack
  })

  it('push fails cleanly with the not-implemented code', async () => {
    const r = await runCli(['push', '--key', 'ds_live_x'], dir)
    expect(r.code).toBe(7)
  })
})
