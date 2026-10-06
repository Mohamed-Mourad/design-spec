import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { resolve } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { defaultSchema } from '@design-spec/compiler'
import { buildMcpServer } from '../src/commands/serve.js'
import { clientId, createMcpTaskReporter, estimateTokens } from '../src/mcpTaskTelemetry.js'
import { runCli, tmpProject, cleanup } from './helpers'

// `serve`'s opt-in token telemetry (design-spec-backend/docs/telemetry-contract.md).
// What matters is mostly negative: nothing leaves without the opt-in, the key
// appears in the Authorization header and nowhere else, and whatever happens
// to a report, the tool call it describes is unaffected.

const KEY = 'ds_live_' + 'A1b2C3d4E5'.repeat(4)

interface Sent {
  url: string
  init: RequestInit
}

/** A fetch that records what it was asked to send and answers as told. */
function recordingFetch(respond: () => Promise<Response> | Response = () => new Response(null, { status: 202 })) {
  const sent: Sent[] = []
  const impl = ((url: string, init: RequestInit) => {
    sent.push({ url, init })
    return Promise.resolve().then(respond)
  }) as unknown as typeof fetch
  return { sent, impl }
}

async function connect(reporter: Awaited<ReturnType<typeof createMcpTaskReporter>>) {
  const server = buildMcpServer(() => defaultSchema, reporter)
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)
  const client = new Client({ name: 'vitest-agent', version: '1.2.3' })
  await client.connect(clientTransport)
  return { client, server }
}

function text(result: unknown): string {
  return (result as { content: Array<{ text: string }> }).content.map((c) => c.text).join('')
}

describe('serve token telemetry', () => {
  let configDir: string

  beforeEach(async () => {
    configDir = await tmpProject()
    // An empty machine config, so only what a test sets can supply a key.
    vi.stubEnv('DESIGN_SPEC_CONFIG_DIR', configDir)
    vi.stubEnv('DESIGN_SPEC_API_URL', 'https://api.example.test')
    vi.stubEnv('DESIGN_SPEC_API_KEY', '')
    vi.stubEnv('DESIGN_SPEC_TELEMETRY', '')
  })
  afterEach(async () => {
    vi.unstubAllEnvs()
    await cleanup(configDir)
  })

  it.each([
    ['no opt-in, key present', { DESIGN_SPEC_API_KEY: KEY }],
    ['opt-in spelled "true", key present', { DESIGN_SPEC_TELEMETRY: 'true', DESIGN_SPEC_API_KEY: KEY }],
    ['opt-in, no key', { DESIGN_SPEC_TELEMETRY: '1' }],
    ['opt-in, malformed key', { DESIGN_SPEC_TELEMETRY: '1', DESIGN_SPEC_API_KEY: 'ds_live_nope' }],
    ['opt-in, key, plain-http remote host', { DESIGN_SPEC_TELEMETRY: '1', DESIGN_SPEC_API_KEY: KEY, DESIGN_SPEC_API_URL: 'http://api.example.test' }],
  ])('sends nothing with %s', async (_name, env) => {
    for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v)
    const { sent, impl } = recordingFetch()
    const reporter = await createMcpTaskReporter(impl)
    expect(reporter).toBeNull()

    const { client, server } = await connect(reporter)
    const result = await client.callTool({ name: 'get_component_tokens', arguments: { component: 'Button' } })
    expect(text(result)).toContain('"component": "Button"')
    await server.close()
    expect(sent).toHaveLength(0)
  })

  it('reports one row per tool call once opted in: counts and ids, nothing else', async () => {
    vi.stubEnv('DESIGN_SPEC_TELEMETRY', '1')
    vi.stubEnv('DESIGN_SPEC_API_KEY', KEY)
    const { sent, impl } = recordingFetch()
    const { client, server } = await connect(await createMcpTaskReporter(impl))

    const button = await client.callTool({ name: 'get_component_tokens', arguments: { component: 'button' } })
    const colors = await client.callTool({ name: 'get_semantic_colors', arguments: {} })
    await server.close()

    expect(sent).toHaveLength(2)
    for (const s of sent) {
      expect(s.url).toBe('https://api.example.test/api/v1/telemetry/mcp-tasks')
      expect(s.init.method).toBe('POST')
      expect((s.init.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY}`)
      // The key is in the header and nowhere else.
      expect(s.url).not.toContain(KEY)
      expect(String(s.init.body)).not.toContain(KEY)
    }
    const [first, second] = sent.map((s) => JSON.parse(String(s.init.body)))

    expect(Object.keys(first).sort()).toEqual(['blueprint', 'input_tokens', 'mode', 'model', 'output_tokens', 'task_id'])
    expect(first).toMatchObject({
      mode: 'mcp',
      blueprint: 'Button', // the resolved blueprint's name, not the caller's spelling
      input_tokens: estimateTokens('{"component":"button"}'),
      output_tokens: estimateTokens(text(button)),
      model: 'vitest-agent/1.2.3',
    })
    expect(first.task_id).toMatch(/^[0-9a-f-]{36}$/)

    // Same session, same task; a tool with no blueprint sends none.
    expect(second.task_id).toBe(first.task_id)
    expect(second.blueprint).toBeUndefined()
    expect(second.output_tokens).toBe(estimateTokens(text(colors)))

    // Sizes only: no token value from the answer travels in a report.
    expect(JSON.stringify([first, second])).not.toContain('#3B6EF5')
  })

  it('reports nothing for a call that resolved to no component', async () => {
    vi.stubEnv('DESIGN_SPEC_TELEMETRY', '1')
    vi.stubEnv('DESIGN_SPEC_API_KEY', KEY)
    const { sent, impl } = recordingFetch()
    const { client, server } = await connect(await createMcpTaskReporter(impl))
    const result = await client.callTool({ name: 'get_component_tokens', arguments: { component: 'zzzzqqqq-not-a-thing' } })
    expect((result as { isError?: boolean }).isError).toBe(true)
    await server.close()
    expect(sent).toHaveLength(0)
  })

  it.each([
    ['the request rejects', () => Promise.reject(new Error('ECONNREFUSED'))],
    ['the API answers 500', () => new Response('{"error":"internal server error"}', { status: 500 })],
    ['the API rejects the key', () => new Response('{"error":"authentication required"}', { status: 401 })],
    [
      'fetch throws synchronously',
      () => {
        throw new TypeError('bad url')
      },
    ],
  ])('a tool call is unaffected when %s, and the report is not retried', async (_name, respond) => {
    vi.stubEnv('DESIGN_SPEC_TELEMETRY', '1')
    vi.stubEnv('DESIGN_SPEC_API_KEY', KEY)
    const sent: Sent[] = []
    const impl = ((url: string, init: RequestInit) => {
      sent.push({ url, init })
      const out = respond() // may throw before a promise exists
      return Promise.resolve(out)
    }) as unknown as typeof fetch

    const unhandled: unknown[] = []
    const onUnhandled = (e: unknown) => unhandled.push(e)
    process.on('unhandledRejection', onUnhandled)
    try {
      const { client, server } = await connect(await createMcpTaskReporter(impl))
      const result = await client.callTool({ name: 'get_layout_system', arguments: {} })
      expect((result as { isError?: boolean }).isError).toBeFalsy()
      expect(JSON.parse(text(result))).toHaveProperty('breakpoints')
      await new Promise((r) => setTimeout(r, 50))
      await server.close()
    } finally {
      process.off('unhandledRejection', onUnhandled)
    }
    expect(sent).toHaveLength(1)
    expect(unhandled).toEqual([])
  })

  it('estimates tokens from length and reduces a client name to an id', () => {
    expect(estimateTokens('')).toBe(0)
    expect(estimateTokens('abcd')).toBe(1)
    expect(estimateTokens('abcde')).toBe(2)
    expect(clientId('claude-code', '2.1.0')).toBe('claude-code/2.1.0')
    expect(clientId('Cursor\n<script>', '0.45')).toBe('Cursorscript/0.45')
    expect(clientId(undefined, undefined)).toBe('unknown')
    expect(clientId('***', '')).toBe('unknown')
    expect(clientId('a'.repeat(300), '1')).toHaveLength(128)
  })
})

// The built binary over real stdio, against a stand-in API: the protocol stays
// clean, the report arrives, and the key shows up in no output.
describe('serve token telemetry (built binary)', () => {
  let dir: string
  let configDir: string
  let api: Server
  let received: { path: string; auth?: string; body: string }[]
  let status: number

  beforeEach(async () => {
    dir = await tmpProject()
    configDir = await tmpProject()
    await runCli(['init', '--yes'], dir)
    received = []
    status = 202
    api = createServer((req, res) => {
      let raw = ''
      req.on('data', (c) => (raw += c))
      req.on('end', () => {
        received.push({ path: req.url!, auth: req.headers.authorization, body: raw })
        res.writeHead(status, { 'Content-Type': 'application/json' })
        res.end(status === 202 ? '' : '{"error":"authentication required"}')
      })
    })
    await new Promise<void>((r) => api.listen(0, '127.0.0.1', r))
  })
  afterEach(async () => {
    await new Promise<void>((r) => api.close(() => r()))
    await cleanup(dir)
    await cleanup(configDir)
  })

  async function session(extraEnv: Record<string, string>) {
    const env: Record<string, string> = {}
    for (const [k, v] of Object.entries(process.env)) if (v !== undefined && !k.startsWith('DESIGN_SPEC_')) env[k] = v
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [resolve(__dirname, '../dist/index.js'), 'serve', '--cwd', dir],
      env: {
        ...env,
        NO_UPDATE_NOTIFIER: '1',
        NO_COLOR: '1',
        DESIGN_SPEC_CONFIG_DIR: configDir,
        DESIGN_SPEC_API_URL: `http://127.0.0.1:${(api.address() as AddressInfo).port}`,
        ...extraEnv,
      },
      stderr: 'pipe',
    })
    let stderr = ''
    transport.stderr?.on('data', (d) => (stderr += d))
    const client = new Client({ name: 'stdio-agent', version: '9.9.9' })
    await client.connect(transport)
    return { client, stderr: () => stderr }
  }

  const settle = () => new Promise((r) => setTimeout(r, 400))

  it('sends nothing without the opt-in, even with a key', async () => {
    const { client } = await session({ DESIGN_SPEC_API_KEY: KEY })
    const result = await client.callTool({ name: 'get_component_tokens', arguments: { component: 'Button' } })
    expect(text(result)).toContain('"component": "Button"')
    await settle()
    await client.close()
    expect(received).toHaveLength(0)
  })

  it('reports once opted in, keeps stdio clean, and never prints the key', async () => {
    const { client, stderr } = await session({ DESIGN_SPEC_API_KEY: KEY, DESIGN_SPEC_TELEMETRY: '1' })
    // The client parsing every frame is the proof stdout carried only protocol.
    const { tools } = await client.listTools()
    expect(tools).toHaveLength(3)
    const result = await client.callTool({ name: 'get_component_tokens', arguments: { component: 'Button' } })
    expect(text(result)).toContain('"component": "Button"')

    const until = Date.now() + 5_000
    while (received.length === 0 && Date.now() < until) await new Promise((r) => setTimeout(r, 25))
    await client.close()

    expect(received).toHaveLength(1)
    expect(received[0].path).toBe('/api/v1/telemetry/mcp-tasks')
    expect(received[0].auth).toBe(`Bearer ${KEY}`)
    expect(JSON.parse(received[0].body)).toMatchObject({ mode: 'mcp', blueprint: 'Button', model: 'stdio-agent/9.9.9' })
    expect(received[0].body).not.toContain(KEY)
    expect(stderr()).not.toContain(KEY)
    expect(stderr()).not.toContain(KEY.slice(8))
  })

  it('a rejected report changes nothing the agent or the terminal sees', async () => {
    status = 401
    const { client, stderr } = await session({ DESIGN_SPEC_API_KEY: KEY, DESIGN_SPEC_TELEMETRY: '1' })
    const first = await client.callTool({ name: 'get_semantic_colors', arguments: {} })
    const second = await client.callTool({ name: 'get_layout_system', arguments: {} })
    expect((first as { isError?: boolean }).isError).toBeFalsy()
    expect((second as { isError?: boolean }).isError).toBeFalsy()
    await settle()
    await client.close()

    expect(received).toHaveLength(2) // one attempt per call, no retries
    expect(stderr()).not.toContain(KEY)
    expect(stderr()).not.toMatch(/telemetry|401|authentication/i)
  })
})
