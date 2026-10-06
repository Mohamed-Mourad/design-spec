import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createServer, type Server } from 'node:http'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { AddressInfo } from 'node:net'
import { runCli, tmpProject, cleanup, seedReactTailwind, type CliResult } from './helpers'

// `sync` / `push` / `watch --sync` driven through the built binary against an
// in-process stand-in for the dashboard API. The stand-in implements the
// contract in design-spec-backend/docs/sync-contract.md: Bearer key auth,
// whole-schema storage, and base_revision optimistic concurrency. The Go side
// of that contract is tested in the backend; this proves the CLI speaks it and
// applies the §20 merge policy on top.

const KEY = 'ds_live_' + 'A1b2C3d4E5'.repeat(4)
const OTHER_KEY = 'ds_test_' + 'Z9y8X7w6V5'.repeat(4)

interface Stored {
  schema: Record<string, any>
  revision: number
  updated_by: 'cli' | 'web'
}

class FakeDashboard {
  projects = new Map<string, Stored>()
  requests: { method: string; path: string; auth?: string; ifNoneMatch?: string; status?: number; body?: any }[] = []
  /** Calls the real API would record as sync activity: every 200/201 on a project. */
  activity = 0
  /** Bump the revision between a read and the next write, like a designer saving. */
  raceNextWrite = false
  server: Server

  constructor() {
    this.server = createServer((req, res) => {
      let raw = ''
      req.on('data', (c) => (raw += c))
      req.on('end', () => {
        const body = raw ? JSON.parse(raw) : undefined
        const ifNoneMatch = req.headers['if-none-match'] as string | undefined
        const seen: FakeDashboard['requests'][number] = { method: req.method!, path: req.url!, auth: req.headers.authorization, ifNoneMatch, body }
        this.requests.push(seen)
        const send = (status: number, payload?: unknown, headers: Record<string, string> = {}) => {
          seen.status = status
          if (status === 200 || status === 201) this.activity++
          res.writeHead(status, { 'Content-Type': 'application/json', ...headers })
          res.end(payload === undefined ? '' : JSON.stringify(payload))
        }
        if (req.headers.authorization !== `Bearer ${KEY}`) return send(401, { error: 'authentication required' })
        const m = /^\/api\/v1\/projects\/([a-z0-9-]+)$/.exec(req.url ?? '')
        if (!m) return send(404, { error: 'not found' })
        const slug = m[1]
        const cur = this.projects.get(slug)
        const meta = (p: Stored) => ({
          project: slug,
          name: p.schema.name,
          revision: p.revision,
          updated_by: p.updated_by,
          created_at: '2026-09-28T00:00:00Z',
          updated_at: '2026-09-28T00:00:00Z',
        })
        if (req.method === 'GET') {
          if (!cur) return send(404, { error: 'not found' })
          const etag = `"rev-${cur.revision}"`
          if (ifNoneMatch === etag) return send(304, undefined, { ETag: etag })
          return send(200, { ...meta(cur), schema_json: cur.schema }, { ETag: etag, 'Cache-Control': 'no-store' })
        }
        if (req.method === 'PUT') {
          if (this.raceNextWrite && cur) {
            this.raceNextWrite = false
            cur.revision++
          }
          const rev = cur?.revision ?? 0
          if (body.base_revision !== undefined && body.base_revision !== rev) {
            return send(409, { error: 'project changed since base_revision' })
          }
          const next: Stored = { schema: body.schema_json, revision: rev + 1, updated_by: 'cli' }
          this.projects.set(slug, next)
          return send(cur ? 200 : 201, meta(next))
        }
        send(405, { error: 'method not allowed' })
      })
    })
  }

  async listen(): Promise<string> {
    await new Promise<void>((r) => this.server.listen(0, '127.0.0.1', r))
    return `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`
  }

  close(): Promise<void> {
    return new Promise((r) => this.server.close(() => r()))
  }

  /** A designer's edit in the web dashboard. */
  webEdit(slug: string, edit: (s: Record<string, any>) => void): void {
    const p = this.projects.get(slug)!
    edit(p.schema)
    p.revision++
    p.updated_by = 'web'
  }

  writes(): number {
    return this.requests.filter((r) => r.method === 'PUT').length
  }
}

const presentation = {
  ogImageStrategy: 'server-render',
  proposalBranding: { companyName: 'Acme Studio', accentColor: '#FF0066' },
}

describe('sync / push', () => {
  let dir: string
  let configDir: string
  let api: FakeDashboard
  let env: Record<string, string>
  const schemaPath = () => join(dir, 'design-spec.schema.json')
  const readSchema = async () => JSON.parse(await readFile(schemaPath(), 'utf8'))
  const cli = (args: string[], extra: Record<string, string> = {}): Promise<CliResult> =>
    runCli(args, dir, { ...env, ...extra })

  beforeEach(async () => {
    dir = await tmpProject()
    configDir = await tmpProject()
    await seedReactTailwind(dir)
    await runCli(['init', '--yes'], dir)
    api = new FakeDashboard()
    env = { DESIGN_SPEC_API_URL: await api.listen(), DESIGN_SPEC_CONFIG_DIR: configDir, NO_COLOR: '1' }
  })
  afterEach(async () => {
    await api.close()
    await cleanup(dir)
    await cleanup(configDir)
  })

  it('push creates the project on the dashboard — never git', async () => {
    const local = await readSchema()
    const r = await cli(['push', '--key', KEY, '--json'])
    expect(r.code).toBe(0)
    const out = JSON.parse(r.stdout)
    expect(out).toMatchObject({ ok: true, project: 'acme-web', created: true, revision: 1 })

    const stored = api.projects.get('acme-web')!
    expect(stored.schema).toEqual(local)
    // Only the dashboard API was spoken to, and only with the key as a Bearer.
    expect(api.requests.every((q) => q.path.startsWith('/api/v1/projects/'))).toBe(true)
    expect(api.requests.every((q) => q.auth === `Bearer ${KEY}`)).toBe(true)
    expect(api.requests.find((q) => q.method === 'PUT')!.body.base_revision).toBe(0)
  })

  it('sync pulls presentation (remote wins) without clobbering local export config, then compiles', async () => {
    await cli(['push', '--key', KEY])
    const before = await readSchema()

    // The designer edits presentation AND the export config in the dashboard,
    // and a token the developer never pulled.
    api.webEdit('acme-web', (s) => {
      s.presentation = presentation
      s.export.cssVariablePrefix = 'web-'
      s.colors.primary = '#010203'
    })
    await writeFile(join(dir, 'tokens.css'), '/* stale */\n')

    const r = await cli(['sync', '--json'])
    expect(r.code).toBe(0)
    const out = JSON.parse(r.stdout)
    expect(out.changed).toBe(true)
    expect(out.presentation.map((c: { path: string }) => c.path)).toContain('presentation.proposalBranding.companyName')
    expect(out.export.taken).toBe(false)
    expect(out.export.differs).toEqual([{ path: 'export.cssVariablePrefix', old: '""', new: '"web-"' }])
    expect(out.tokensNotPulled).toBe(1)

    const after = await readSchema()
    expect(after.presentation).toEqual(presentation) // remote wins
    expect(after.export).toEqual(before.export) // local wins
    expect(after.colors.primary).toBe(before.colors.primary) // git is canonical
    // compiled
    expect(await readFile(join(dir, 'tokens.css'), 'utf8')).not.toContain('stale')
    expect((await cli(['lint'])).code).toBe(0)
  })

  it('shows a human merge diff summary', async () => {
    await cli(['push', '--key', KEY])
    api.webEdit('acme-web', (s) => {
      s.presentation = presentation
      s.export.cssVariablePrefix = 'web-'
    })
    const r = await cli(['sync'])
    expect(r.code).toBe(0)
    expect(r.stdout).toMatch(/presentation\.proposalBranding\.companyName.*pulled \(remote wins\)/)
    expect(r.stdout).toMatch(/export\.cssVariablePrefix.*kept local/)
    expect(r.stdout).toMatch(/--force/)
  })

  it('sync --force takes the dashboard export config', async () => {
    await cli(['push', '--key', KEY])
    api.webEdit('acme-web', (s) => (s.export.cssVariablePrefix = 'web-'))
    const r = await cli(['sync', '--force', '--json'])
    expect(r.code).toBe(0)
    expect(JSON.parse(r.stdout).export.taken).toBe(true)
    expect((await readSchema()).export.cssVariablePrefix).toBe('web-')
    expect(await readFile(join(dir, 'tokens.css'), 'utf8')).toContain('--web-')
  })

  it('remote wins on removal: presentation dropped in the dashboard is dropped locally', async () => {
    const s = await readSchema()
    s.presentation = presentation
    await writeFile(schemaPath(), JSON.stringify(s, null, 2) + '\n')
    await cli(['push', '--key', KEY])
    api.webEdit('acme-web', (x) => delete x.presentation)
    expect((await cli(['sync'])).code).toBe(0)
    expect((await readSchema()).presentation).toBeUndefined()
  })

  it('push sends local tokens but keeps the dashboard presentation', async () => {
    await cli(['push', '--key', KEY])
    api.webEdit('acme-web', (s) => (s.presentation = presentation))

    const s = await readSchema()
    s.colors.primary = '#ABCDEF'
    s.presentation = { ogImageStrategy: 'client-canvas' }
    await writeFile(schemaPath(), JSON.stringify(s, null, 2) + '\n')

    const r = await cli(['push', '--json'])
    expect(r.code).toBe(0)
    const out = JSON.parse(r.stdout)
    expect(out.tokens.changes).toEqual([expect.objectContaining({ path: 'colors.primary', new: '#ABCDEF' })])
    expect(out.presentationKept.length).toBeGreaterThan(0)

    const stored = api.projects.get('acme-web')!
    expect(stored.schema.colors.primary).toBe('#ABCDEF')
    expect(stored.schema.presentation).toEqual(presentation)
    expect(stored.revision).toBe(3)
  })

  it('sync and push read with plain GETs — only the watch poll is conditional', async () => {
    await cli(['push', '--key', KEY])
    await cli(['sync'])
    await cli(['push'])
    const reads = api.requests.filter((q) => q.method === 'GET')
    expect(reads.length).toBeGreaterThanOrEqual(3)
    expect(reads.every((q) => q.ifNoneMatch === undefined)).toBe(true)
  })

  it('pushing an unchanged schema sends nothing and keeps the revision', async () => {
    await cli(['push', '--key', KEY])
    const r = await cli(['push', '--json'])
    expect(r.code).toBe(0)
    expect(JSON.parse(r.stdout)).toMatchObject({ ok: true, unchanged: true, revision: 1 })
    expect(api.writes()).toBe(1)
    expect(api.projects.get('acme-web')!.revision).toBe(1)

    // Key order is not a change: the dashboard may hand the schema back reordered.
    const stored = api.projects.get('acme-web')!
    stored.schema = Object.fromEntries(Object.entries(stored.schema).reverse())
    const human = await cli(['push'])
    expect(human.stdout + human.stderr).toMatch(/"acme-web" is already up to date \(rev 1\)/)
    expect(api.writes()).toBe(1)

    // …while a presentation-only local difference is kept remote, so still a no-op.
    const s = await readSchema()
    s.presentation = { ogImageStrategy: 'client-canvas' }
    await writeFile(schemaPath(), JSON.stringify(s, null, 2) + '\n')
    expect(JSON.parse((await cli(['push', '--json'])).stdout).unchanged).toBe(true)
    expect(api.writes()).toBe(1)
  })

  it('a dashboard save that lands mid-push is a conflict, not a lost edit', async () => {
    await cli(['push', '--key', KEY])
    const s = await readSchema()
    s.colors.primary = '#123456'
    await writeFile(schemaPath(), JSON.stringify(s, null, 2) + '\n')
    api.raceNextWrite = true
    const r = await cli(['push'])
    expect(r.code).toBe(9) // ExitCode.REMOTE
    expect(r.stderr).toMatch(/changed while this ran/)
  })

  it('--key is remembered in the machine config and never printed', async () => {
    const first = await cli(['push', '--key', KEY])
    expect(first.code).toBe(0)
    const config = JSON.parse(await readFile(join(configDir, 'config.json'), 'utf8'))
    expect(config.apiKey).toBe(KEY)

    const second = await cli(['sync'])
    expect(second.code).toBe(0)
    for (const r of [first, second]) {
      expect(r.stdout + r.stderr).not.toContain(KEY)
    }
    expect(first.stdout).toContain('ds_live_…' + KEY.slice(-4))
  })

  it('DESIGN_SPEC_API_KEY works without a flag and is not saved', async () => {
    const r = await cli(['push'], { DESIGN_SPEC_API_KEY: KEY })
    expect(r.code).toBe(0)
    expect(existsSync(join(configDir, 'config.json'))).toBe(false)
  })

  it('auth failures exit with the auth code and never echo the key', async () => {
    const none = await cli(['sync'])
    expect(none.code).toBe(8)
    expect(none.stderr).toMatch(/No API key/)

    const malformed = await cli(['push', '--key', 'ds_live_nope'])
    expect(malformed.code).toBe(8)
    expect(api.requests).toHaveLength(0) // rejected before any network call

    const rejected = await cli(['push', '--key', OTHER_KEY])
    expect(rejected.code).toBe(8)
    expect(rejected.stderr).toMatch(/rejected your API key/)
    expect(rejected.stdout + rejected.stderr).not.toContain(OTHER_KEY)
    expect(existsSync(join(configDir, 'config.json'))).toBe(false) // a rejected key is not remembered
  })

  it('refuses to send a key over plain http to a remote host', async () => {
    const r = await cli(['push', '--key', KEY], { DESIGN_SPEC_API_URL: 'http://api.example.com' })
    expect(r.code).toBe(2)
    expect(r.stderr).toMatch(/insecure/)
  })

  it('sync on a project the dashboard lacks points at push', async () => {
    const r = await cli(['sync', '--key', KEY])
    expect(r.code).toBe(9)
    expect(r.stderr).toMatch(/design-spec push/)
  })

  it('--dry-run: sync previews the schema diff and writes nothing; push sends nothing', async () => {
    await cli(['push', '--key', KEY])
    api.webEdit('acme-web', (s) => (s.presentation = presentation))
    const before = await readFile(schemaPath(), 'utf8')

    const sync = await cli(['--dry-run', 'sync'])
    expect(sync.code).toBe(0)
    expect(sync.stdout).toMatch(/design-spec\.schema\.json/)
    expect(sync.stdout).toMatch(/Acme Studio/)
    expect(await readFile(schemaPath(), 'utf8')).toBe(before)

    const s = await readSchema()
    s.colors.primary = '#654321'
    await writeFile(schemaPath(), JSON.stringify(s, null, 2) + '\n')
    const writes = api.writes()
    const push = await cli(['--dry-run', 'push', '--json'])
    expect(push.code).toBe(0)
    expect(JSON.parse(push.stdout)).toMatchObject({ dryRun: true, unchanged: false, revision: null })
    expect(api.writes()).toBe(writes)
  })

  it('--project overrides the default slug', async () => {
    const r = await cli(['push', '--key', KEY, '--project', 'my-system'])
    expect(r.code).toBe(0)
    expect(api.projects.has('my-system')).toBe(true)
    expect((await cli(['push', '--project', 'Not_Valid'])).code).toBe(2)
  })
})

describe('watch --sync', () => {
  let dir: string
  let configDir: string
  let api: FakeDashboard
  const polls = () => api.requests.filter((q) => q.method === 'GET' && q.ifNoneMatch !== undefined)

  beforeEach(async () => {
    dir = await tmpProject()
    configDir = await tmpProject()
    await seedReactTailwind(dir)
    await runCli(['init', '--yes'], dir)
    api = new FakeDashboard()
  })
  afterEach(async () => {
    await api.close()
    await cleanup(dir)
    await cleanup(configDir)
  })

  it('pulls presentation at start and pushes after each save', async () => {
    const url = await api.listen()
    const env = { ...process.env, NO_UPDATE_NOTIFIER: '1', NO_COLOR: '1', DESIGN_SPEC_API_URL: url, DESIGN_SPEC_CONFIG_DIR: configDir }
    expect((await runCli(['push', '--key', KEY], dir, env as Record<string, string>)).code).toBe(0)
    api.webEdit('acme-web', (s) => (s.presentation = presentation))

    const child = spawn(process.execPath, [resolve(__dirname, '../dist/index.js'), 'watch', '--sync'], { cwd: dir, env })
    let output = ''
    child.stdout.on('data', (d) => (output += d))
    child.stderr.on('data', (d) => (output += d))
    const waitFor = async (pred: () => boolean, what: string) => {
      const until = Date.now() + 10_000
      while (!pred()) {
        if (Date.now() > until) throw new Error(`timed out waiting for ${what}\n${output}`)
        await new Promise((r) => setTimeout(r, 50))
      }
    }

    try {
      const schemaPath = join(dir, 'design-spec.schema.json')
      await waitFor(() => /Synced "acme-web"/.test(output), 'the initial sync')
      expect(JSON.parse(await readFile(schemaPath, 'utf8')).presentation).toEqual(presentation)

      await new Promise((r) => setTimeout(r, 300)) // let chokidar reach ready
      const writes = api.writes()
      const s = JSON.parse(await readFile(schemaPath, 'utf8'))
      s.colors.primary = '#0A0B0C'
      await writeFile(schemaPath, JSON.stringify(s, null, 2) + '\n')

      await waitFor(() => api.writes() > writes, 'a push after the save')
      await waitFor(() => /pushed "acme-web"/.test(output), 'the push report')
      const stored = api.projects.get('acme-web')!
      expect(stored.schema.colors.primary).toBe('#0A0B0C')
      expect(stored.schema.presentation).toEqual(presentation)
      expect(await readFile(join(dir, 'tokens.css'), 'utf8')).toContain('#0A0B0C')

      // The push wrote nothing locally, so it did not loop back into the watcher.
      await new Promise((r) => setTimeout(r, 500))
      expect(api.writes()).toBe(writes + 1)
    } finally {
      // Wait for the exit: on Windows a live child holds its cwd, and the temp
      // dir can't be removed until it lets go.
      const exited = new Promise((r) => child.once('exit', r))
      child.kill()
      await exited
    }
  })

  it('an idle session polls with 304s and adds no sync activity', async () => {
    const url = await api.listen()
    const env = {
      ...process.env,
      NO_UPDATE_NOTIFIER: '1',
      NO_COLOR: '1',
      DESIGN_SPEC_API_URL: url,
      DESIGN_SPEC_CONFIG_DIR: configDir,
      DESIGN_SPEC_SYNC_INTERVAL_MS: '200',
    }
    expect((await runCli(['push', '--key', KEY], dir, env as Record<string, string>)).code).toBe(0)

    const child = spawn(process.execPath, [resolve(__dirname, '../dist/index.js'), 'watch', '--sync'], { cwd: dir, env })
    let output = ''
    child.stdout.on('data', (d) => (output += d))
    child.stderr.on('data', (d) => (output += d))
    const waitFor = async (pred: () => boolean, what: string) => {
      const until = Date.now() + 10_000
      while (!pred()) {
        if (Date.now() > until) throw new Error(`timed out waiting for ${what}\n${output}`)
        await new Promise((r) => setTimeout(r, 50))
      }
    }

    try {
      await waitFor(() => /Synced "acme-web"/.test(output), 'the initial sync')
      // The initial sync is a real one and counts; everything after it is idle.
      const activity = api.activity
      const schema = await readFile(join(dir, 'design-spec.schema.json'), 'utf8')

      await waitFor(() => polls().filter((q) => q.status !== undefined).length >= 4, 'four polls')
      expect(polls().filter((q) => q.status !== undefined).every((q) => q.ifNoneMatch === '"rev-1"' && q.status === 304)).toBe(true)
      expect(api.activity).toBe(activity)
      expect(api.writes()).toBe(1) // the push that created the project, nothing since
      expect(await readFile(join(dir, 'design-spec.schema.json'), 'utf8')).toBe(schema)
      expect(output).not.toMatch(/from the dashboard|pushed "|failed/)
    } finally {
      const exited = new Promise((r) => child.once('exit', r))
      child.kill()
      await exited
    }
  })

  it('picks up a dashboard edit mid-session, and one PUT per real change — none after a pull', async () => {
    const url = await api.listen()
    const env = {
      ...process.env,
      NO_UPDATE_NOTIFIER: '1',
      NO_COLOR: '1',
      DESIGN_SPEC_API_URL: url,
      DESIGN_SPEC_CONFIG_DIR: configDir,
      DESIGN_SPEC_SYNC_INTERVAL_MS: '400',
    }
    expect((await runCli(['push', '--key', KEY], dir, env as Record<string, string>)).code).toBe(0)

    const child = spawn(process.execPath, [resolve(__dirname, '../dist/index.js'), 'watch', '--sync'], { cwd: dir, env })
    let output = ''
    child.stdout.on('data', (d) => (output += d))
    child.stderr.on('data', (d) => (output += d))
    const waitFor = async (pred: () => boolean | Promise<boolean>, what: string, ms = 10_000) => {
      const until = Date.now() + ms
      while (!(await pred())) {
        if (Date.now() > until) throw new Error(`timed out waiting for ${what}\n${output}`)
        await new Promise((r) => setTimeout(r, 50))
      }
    }
    const schemaPath = join(dir, 'design-spec.schema.json')
    const local = async () => JSON.parse(await readFile(schemaPath, 'utf8'))
    const puts = () => api.writes()

    try {
      await waitFor(() => /Synced "acme-web"/.test(output), 'the initial sync')
      await new Promise((r) => setTimeout(r, 300)) // let chokidar reach ready
      const before = puts()

      // A designer saves presentation in the dashboard while the watch runs.
      api.webEdit('acme-web', (x) => (x.presentation = presentation))
      const revAfterWeb = api.projects.get('acme-web')!.revision
      await waitFor(async () => JSON.stringify((await local()).presentation) === JSON.stringify(presentation), 'the pull to land', 2_000)
      await waitFor(() => /pulled \d+ presentation change\(s\) from the dashboard \(rev \d+\)/.test(output), 'the pull report')

      // The pull's write recompiled; the push after it had nothing to send.
      await waitFor(async () => (await readFile(join(dir, 'tokens.css'), 'utf8')).length > 0, 'the recompile')
      await new Promise((r) => setTimeout(r, 1_500)) // several intervals
      expect(puts()).toBe(before)
      expect(api.projects.get('acme-web')!.revision).toBe(revAfterWeb)

      // A real local change is exactly one PUT, carrying the pulled presentation.
      const s = await local()
      s.colors.primary = '#0A0B0C'
      await writeFile(schemaPath, JSON.stringify(s, null, 2) + '\n')
      await waitFor(() => puts() > before, 'a push after the save')
      await new Promise((r) => setTimeout(r, 1_500))
      expect(puts()).toBe(before + 1)
      // The poll follows the revision: after the web edit, then after its own push.
      const asked = polls().map((q) => q.ifNoneMatch)
      expect(asked).toContain('"rev-1"')
      expect(asked).toContain(`"rev-${revAfterWeb}"`)
      expect(asked.at(-1)).toBe(`"rev-${revAfterWeb + 1}"`)
      const stored = api.projects.get('acme-web')!
      expect(stored.schema.colors.primary).toBe('#0A0B0C')
      expect(stored.schema.presentation).toEqual(presentation)
    } finally {
      const exited = new Promise((r) => child.once('exit', r))
      child.kill()
      await exited
    }
  })
})
