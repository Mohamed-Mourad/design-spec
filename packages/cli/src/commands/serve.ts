// commands/serve.ts — local MCP server (stdio). The upstream "semantic firewall".
//
// Runs IN-PROCESS in the developer's environment (no network hop), reading the
// committed design-spec.schema.json and hot-reloading on change. It registers
// the semantic-routing tools whose handlers delegate to the SAME pure compiler
// resolvers the web app and Janitor use (zero schema duplication). Each tool
// returns only the slice the agent asked for — never the whole schema.
//
// CRITICAL: stdout is the MCP protocol channel. Nothing but protocol frames may
// be written to it here — all human/diagnostic output goes to stderr.

import type { Command } from 'commander'
import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import chokidar from 'chokidar'
import { action } from '../run.js'
import { findSchema, loadSchema } from '../project.js'
import { NotInitializedError } from '../errors.js'
import * as ui from '../ui.js'
import {
  get_component_tokens,
  get_layout_system,
  get_semantic_colors,
  type DesignSystemSchema,
} from '@design-spec/compiler'

function jsonContent(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] }
}

/**
 * Build the MCP server around a schema accessor. The accessor is read on every
 * call so hot-reload is transparent to handlers. Exported for tests.
 */
export function buildMcpServer(getSchema: () => DesignSystemSchema): McpServer {
  const server = new McpServer({ name: 'design-spec', version: '0.1.0' })

  server.registerTool(
    'get_component_tokens',
    {
      description: 'Resolved design tokens for a single component (e.g. "Button"). Returns only that component.',
      inputSchema: { component: z.string().describe('Component blueprint name, e.g. "Button"') },
    },
    ({ component }) => {
      const slice = get_component_tokens(getSchema(), component)
      if (!slice) return { content: [{ type: 'text', text: `Unknown component: ${component}` }], isError: true }
      return jsonContent(slice)
    },
  )

  server.registerTool(
    'get_layout_system',
    { description: 'The layout system only: grid, container, spacing scale, and breakpoints.', inputSchema: {} },
    () => jsonContent(get_layout_system(getSchema())),
  )

  server.registerTool(
    'get_semantic_colors',
    { description: 'Semantic color roles (excludes raw palette scale steps).', inputSchema: {} },
    () => jsonContent(get_semantic_colors(getSchema())),
  )

  return server
}

export function registerServe(program: Command): void {
  program
    .command('serve')
    .description('run a local MCP server (stdio) that feeds AI agents scoped token context')
    .addHelpText('after', '\nExample (in an MCP client config):\n  command: "design-spec", args: ["serve"]')
    .action(
      action(async () => {
        const cwd = process.cwd()
        const schemaPath = findSchema(cwd)
        if (!schemaPath) throw new NotInitializedError(cwd)

        let current = (await loadSchema(cwd)).schema

        // A human running `serve` in a terminal gets a header — on STDERR, since
        // stdout is the MCP protocol channel. MCP clients spawn with pipes (no
        // TTY) and see nothing extra.
        if (process.stderr.isTTY) ui.brandHeader('design-spec serve', 'Local MCP server — scoped token context', { stderr: true })

        // Hot-reload: keep the last good schema if a save is briefly invalid.
        const watcher = chokidar.watch(schemaPath, { ignoreInitial: true })
        watcher.on('change', () => {
          loadSchema(cwd)
            .then(({ schema }) => {
              current = schema
              process.stderr.write('design-spec: schema reloaded\n')
            })
            .catch((e) => process.stderr.write(`design-spec: reload skipped (${(e as Error).message})\n`))
        })

        const server = buildMcpServer(() => current)
        const transport = new StdioServerTransport()
        await server.connect(transport)
        process.stderr.write('design-spec: MCP server ready on stdio\n')

        await new Promise<void>((resolve) => {
          process.on('SIGINT', () => {
            void watcher.close().then(() => server.close()).then(resolve)
          })
        })
      }),
    )
}
