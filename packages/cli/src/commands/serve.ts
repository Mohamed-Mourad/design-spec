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
import { splashContext } from '../branding.js'
import { currentInvocation, connectHints, printableConfig } from '../mcpConfig.js'
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
    .option('--print-config', 'print copy-paste setup for connecting an AI client, then exit', false)
    .addHelpText(
      'after',
      '\nThis is an MCP server (stdio) — connect an AI tool to it, do not type at it.\n' +
        'Run `design-spec serve --print-config` for copy-paste setup, or\n' +
        '`npx @modelcontextprotocol/inspector design-spec serve` to click the tools in a browser.',
    )
    .action(
      action(async (opts: { printConfig?: boolean }) => {
        const cwd = process.cwd()
        const schemaPath = findSchema(cwd)
        if (!schemaPath) throw new NotInitializedError(cwd)

        const inv = currentInvocation(process.argv[1] ?? 'design-spec', process.execPath)

        // --print-config: emit setup and exit. The user explicitly asked for the
        // config text, so it goes to stdout (this run is not a protocol channel).
        if (opts.printConfig) {
          process.stdout.write(printableConfig(inv, cwd) + '\n')
          return
        }

        let current = (await loadSchema(cwd)).schema

        // A human running `serve` in a terminal gets the splash — on STDERR,
        // since stdout is the MCP protocol channel. MCP clients spawn with pipes
        // (no TTY) and see nothing extra.
        if (process.stderr.isTTY) {
          ui.splash(
            splashContext(cwd, {
              tip: 'MCP server ready on stdio · Press Ctrl+C to stop.',
              status: `${current.name} · tools: get_component_tokens, get_layout_system, get_semantic_colors`,
            }),
            { stderr: true },
          )
          // A human ran this in a terminal — tell them how to actually use it.
          ui.box('Connect an AI tool', connectHints(inv), { stderr: true })
        }

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
        // The TTY splash already says "ready"; only log for non-TTY MCP clients.
        if (!process.stderr.isTTY) process.stderr.write('design-spec: MCP server ready on stdio (run `design-spec serve --print-config` for client setup)\n')

        await new Promise<void>((resolve) => {
          process.on('SIGINT', () => {
            void watcher.close().then(() => server.close()).then(resolve)
          })
        })
      }),
    )
}
