import { describe, it, expect } from 'vitest'
import {
  currentInvocation,
  mcpServersJson,
  inspectorCommand,
  claudeCodeAddCommand,
  printableConfig,
} from '../src/mcpConfig.js'

describe('currentInvocation', () => {
  it('uses the bare `design-spec` command when run from an installed package', () => {
    const inv = currentInvocation('/usr/lib/node_modules/design-spec/dist/index.js', '/usr/bin/node')
    expect(inv).toMatchObject({ command: 'design-spec', args: ['serve'] })
  })

  it('uses node + script path when run locally (pre-publish)', () => {
    const inv = currentInvocation('/work/design-spec/packages/cli/dist/index.js', '/usr/bin/node')
    expect(inv.command).toBe('/usr/bin/node')
    expect(inv.args).toEqual(['/work/design-spec/packages/cli/dist/index.js', 'serve'])
  })
})

describe('config rendering', () => {
  const inv = currentInvocation('/work/cli/dist/index.js', '/usr/bin/node')

  it('emits a valid mcpServers JSON entry', () => {
    const parsed = JSON.parse(mcpServersJson(inv, '/proj'))
    expect(parsed.mcpServers['design-spec']).toEqual({
      command: '/usr/bin/node',
      args: ['/work/cli/dist/index.js', 'serve'],
      cwd: '/proj',
    })
  })

  it('shell-quotes command tokens that contain spaces', () => {
    const spaced = currentInvocation('C:\\Program Files\\app\\index.js', 'C:\\Program Files\\nodejs\\node.exe')
    const line = inspectorCommand(spaced)
    expect(line).toContain('"C:\\Program Files\\nodejs\\node.exe"')
    expect(line).toContain('"C:\\Program Files\\app\\index.js"')
  })

  it('builds a claude mcp add one-liner', () => {
    expect(claudeCodeAddCommand(inv)).toBe('claude mcp add design-spec -- /usr/bin/node /work/cli/dist/index.js serve')
  })

  it('printableConfig covers inspector, claude code, and the JSON block', () => {
    const out = printableConfig(inv, '/proj')
    expect(out).toContain('@modelcontextprotocol/inspector')
    expect(out).toContain('claude mcp add design-spec')
    expect(out).toContain('"mcpServers"')
    expect(out).toContain('get_component_tokens')
  })
})
