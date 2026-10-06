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
//
// With DESIGN_SPEC_TELEMETRY=1 and an API key, each tool call also reports its
// token counts to the dashboard (mcpTaskTelemetry.ts). Off by default; a
// report is sent after the answer is built and can never change or delay it.

import type { Command } from 'commander'
import { resolve } from 'node:path'
import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import chokidar from 'chokidar'
import { action } from '../run.js'
import { findSchema, loadSchema } from '../project.js'
import { NotInitializedError } from '../errors.js'
import { splashContext } from '../branding.js'
import { currentInvocation, connectHints, printableConfig } from '../mcpConfig.js'
import { disablePlan } from '../plan.js'
import * as ui from '../ui.js'
import { clientId, createMcpTaskReporter, type McpTaskReporter } from '../mcpTaskTelemetry.js'
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
 *
 * `reporter` is the opt-in token telemetry; without one nothing is reported.
 */
export function buildMcpServer(getSchema: () => DesignSystemSchema, reporter: McpTaskReporter | null = null): McpServer {
  const server = new McpServer({ name: 'design-spec', version: '0.1.0' })

  /** Answer with `value`, and report the call's size when telemetry is on. */
  const answer = (args: unknown, value: unknown, blueprint?: string) => {
    const result = jsonContent(value)
    if (reporter) {
      const client = server.server.getClientVersion()
      reporter.report({
        blueprint,
        input: JSON.stringify(args ?? {}),
        output: result.content[0].text,
        client: clientId(client?.name, client?.version),
      })
    }
    return result
  }

  server.registerTool(
    'get_component_tokens',
    {
      description: 'Resolved design tokens for a single component (e.g. "Button"). Returns only that component.',
      inputSchema: { component: z.string().describe('Component blueprint name, e.g. "Button"') },
    },
    (args) => {
      const slice = get_component_tokens(getSchema(), args.component)
      if (!slice) return { content: [{ type: 'text', text: `Unknown component: ${args.component}` }], isError: true }
      // The resolved blueprint's own name — never the caller's free text.
      return answer(args, slice, slice.component)
    },
  )

  server.registerTool(
    'get_layout_system',
    { description: 'The layout system only: grid, container, spacing scale, and breakpoints.', inputSchema: {} },
    (args) => answer(args, get_layout_system(getSchema())),
  )

  server.registerTool(
    'get_semantic_colors',
    { description: 'Semantic color roles (excludes raw palette scale steps).', inputSchema: {} },
    (args) => answer(args, get_semantic_colors(getSchema())),
  )

  return server
}

export function registerServe(program: Command): void {
  program
    .command('serve')
    .description('run a local MCP server (stdio) that feeds AI agents scoped token context')
    .option('--print-config', 'print copy-paste setup for connecting an AI client, then exit', false)
    .option('--cwd <dir>', 'project directory containing design-spec.schema.json (default: current dir)')
    .addHelpText(
      'after',
      '\nThis is an MCP server (stdio) — connect an AI tool to it, do not type at it.\n' +
        'Run `design-spec serve --print-config` for copy-paste setup, or\n' +
        '`npx @modelcontextprotocol/inspector design-spec serve` to click the tools in a browser.\n' +
        'A client spawns serve from its own directory — pass --cwd to point at your project.',
    )
    .action(
      action(async (opts: { printConfig?: boolean; cwd?: string }) => {
        // serve writes nothing and is long-running; plan mode (and its end-of-run
        // diff render) doesn't apply. Opt out silently — stdout is the MCP channel.
        disablePlan()
        // A client (or the MCP Inspector) spawns serve from its own directory, not
        // the project — --cwd lets it point at the schema regardless of launch dir.
        const cwd = opts.cwd ? resolve(opts.cwd) : process.cwd()

        const inv = currentInvocation(process.argv[1] ?? 'design-spec', process.execPath)

        // --print-config: emit setup and exit (before the schema check, so it works
        // even from an uninitialized dir while the user is still wiring things up).
        if (opts.printConfig) {
          process.stdout.write(printableConfig(inv, cwd) + '\n')
          return
        }

        const schemaPath = findSchema(cwd)
        if (!schemaPath) throw new NotInitializedError(cwd)

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
          ui.box('Connect an AI tool', connectHints(inv, cwd), { stderr: true })
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

        const server = buildMcpServer(() => current, await createMcpTaskReporter())
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
