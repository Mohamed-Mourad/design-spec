import { describe, it, expect } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { defaultSchema } from '@design-spec/compiler'
import { buildMcpServer } from '../src/commands/serve.js'

async function connectedClient() {
  const server = buildMcpServer(() => defaultSchema)
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)
  const client = new Client({ name: 'test', version: '0.0.0' })
  await client.connect(clientTransport)
  return { client, server }
}

function text(result: unknown): string {
  const content = (result as { content: Array<{ type: string; text: string }> }).content
  return content.map((c) => c.text).join('')
}

describe('serve (MCP)', () => {
  it('registers the three semantic-routing tools', async () => {
    const { client, server } = await connectedClient()
    const { tools } = await client.listTools()
    const names = tools.map((t) => t.name).sort()
    expect(names).toEqual(['get_component_tokens', 'get_layout_system', 'get_semantic_colors'])
    await server.close()
  })

  it('get_component_tokens returns ONLY the requested component slice', async () => {
    const { client, server } = await connectedClient()
    const result = await client.callTool({ name: 'get_component_tokens', arguments: { component: 'Button' } })
    const body = text(result)
    expect(body).toContain('"component": "Button"')
    expect(body).not.toContain('Input') // no leakage of other components
    await server.close()
  })

  it('get_semantic_colors returns roles, never a whole-schema dump', async () => {
    const { client, server } = await connectedClient()
    const colors = JSON.parse(text(await client.callTool({ name: 'get_semantic_colors', arguments: {} })))
    expect(colors.primary).toBe('#2563EB')
    expect(colors.componentBlueprints).toBeUndefined()
    await server.close()
  })

  it('reports an error for an unknown component', async () => {
    const { client, server } = await connectedClient()
    const result = await client.callTool({ name: 'get_component_tokens', arguments: { component: 'Nope' } })
    expect((result as { isError?: boolean }).isError).toBe(true)
    await server.close()
  })
})
