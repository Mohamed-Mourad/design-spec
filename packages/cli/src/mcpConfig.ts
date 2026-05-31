// mcpConfig.ts — copy-paste setup for connecting an MCP client to `serve`.
//
// `serve` speaks stdio JSON-RPC: there is nothing to "type" at it. A user wires
// it into an AI client (Claude Desktop, Cursor, Windsurf, Claude Code) or pokes
// it with the MCP Inspector. This module renders that guidance for the running
// binary — using the real invocation path so it works before the package is
// published to npm.

export interface Invocation {
  /** Command an MCP client should spawn. */
  command: string
  /** Args for that command (ending in "serve"). */
  args: string[]
  /** Human label for how this binary is currently runnable. */
  label: string
}

/**
 * How to invoke this exact binary. Post-publish that's the `design-spec` shim on
 * PATH; pre-publish (local dev / testing) it's `node <path-to>/index.js`, which we
 * read from argv so the snippet is guaranteed to run right now.
 */
export function currentInvocation(scriptPath: string, nodePath: string): Invocation {
  const published = /[\\/]node_modules[\\/]/.test(scriptPath) || scriptPath.endsWith('design-spec')
  if (published) return { command: 'design-spec', args: ['serve'], label: 'design-spec serve' }
  // Forward slashes: Windows node accepts them, and (unlike `\`) the MCP Inspector
  // doesn't strip them when it parses the spawn args, so the snippet runs as pasted.
  const node = nodePath.replace(/\\/g, '/')
  const script = scriptPath.replace(/\\/g, '/')
  return { command: node, args: [script, 'serve'], label: `node ${script} serve` }
}

/** JSON config block (the `mcpServers` entry) shared by Claude Desktop / Cursor / Windsurf. */
export function mcpServersJson(inv: Invocation, cwd: string): string {
  return JSON.stringify(
    { mcpServers: { 'design-spec': { command: inv.command, args: inv.args, cwd } } },
    null,
    2,
  )
}

/** Shell-quote a token that contains spaces so copy-pasted commands don't split it. */
function shellQuote(token: string): string {
  return /[\s"]/.test(token) ? `"${token.replace(/"/g, '\\"')}"` : token
}

/** Forward-slash a path so Windows paths survive the MCP Inspector's arg parsing. */
function fwd(p: string): string {
  return p.replace(/\\/g, '/')
}

/**
 * The full spawn command line. `cwd` is appended as `--cwd` because the Inspector
 * and `claude mcp add` launch serve from their OWN directory, not the project —
 * without it serve can't find design-spec.schema.json. (The JSON config sets the
 * client's `cwd` field instead, so it omits this.)
 */
function commandLine(inv: Invocation, cwd?: string): string {
  const parts = [inv.command, ...inv.args]
  if (cwd) parts.push('--cwd', fwd(cwd))
  return parts.map(shellQuote).join(' ')
}

/** The `claude mcp add` one-liner (Claude Code CLI). */
export function claudeCodeAddCommand(inv: Invocation, cwd?: string): string {
  return `claude mcp add design-spec -- ${commandLine(inv, cwd)}`
}

/** The MCP Inspector command — the fastest zero-client way to click the tools. */
export function inspectorCommand(inv: Invocation, cwd?: string): string {
  return `npx @modelcontextprotocol/inspector ${commandLine(inv, cwd)}`
}

/** True when running an unlinked local build (command is `node <path>`, not the shim). */
function isLocal(inv: Invocation): boolean {
  return inv.command !== 'design-spec'
}

/** Short, friendly lines for the TTY splash — points at the two easiest paths. */
export function connectHints(inv: Invocation, cwd: string): string[] {
  const lines = ['This is an MCP server — connect an AI tool to it, don\'t type here.', '']
  if (isLocal(inv)) {
    lines.push(
      'Tip: for the simplest setup, install the command once:',
      '  npm link   (run in design-spec/packages/cli)   →   then use `design-spec serve`',
      '',
    )
  }
  lines.push(
    'Fastest test (opens a UI in your browser, no setup):',
    `  ${inspectorCommand(inv, cwd)}`,
    '',
    'Connect Claude Code:',
    `  ${claudeCodeAddCommand(inv, cwd)}`,
    '',
    'Claude Desktop / Cursor / Windsurf: paste the JSON config from',
    '  design-spec serve --print-config',
  )
  return lines
}

/** Full copy-paste setup printed by `serve --print-config` (goes to stdout). */
export function printableConfig(inv: Invocation, cwd: string): string {
  const json = mcpServersJson(inv, cwd)
  return [
    '# Connect an AI tool to this design system over MCP',
    '',
    `Detected invocation: ${inv.label}`,
    `Project (cwd):       ${cwd}`,
    ...(isLocal(inv)
      ? [
          '',
          'Tip: running an unpublished local build. For the simplest, most reliable',
          'setup (especially on Windows), install the command once:',
          '  npm link        # run in design-spec/packages/cli',
          'then use `design-spec serve` everywhere below instead of the node path.',
        ]
      : []),
    '',
    '────────────────────────────────────────────────────────',
    'Quick test — no client needed (opens a browser UI):',
    '',
    `  ${inspectorCommand(inv, cwd)}`,
    '',
    'In the Inspector: Connect → Tools → get_component_tokens',
    '  with input {"component":"Button"}.',
    '',
    '────────────────────────────────────────────────────────',
    'Claude Code (CLI) — one command, runnable from anywhere:',
    '',
    `  ${claudeCodeAddCommand(inv, cwd)}`,
    '',
    '────────────────────────────────────────────────────────',
    'Claude Desktop — add to claude_desktop_config.json',
    '  (macOS: ~/Library/Application Support/Claude/  ·  Windows: %APPDATA%\\Claude\\):',
    'Cursor — add to .cursor/mcp.json  ·  Windsurf — ~/.codeium/windsurf/mcp_config.json',
    '',
    json,
    '',
    'Then restart the client and ask it for a component\'s tokens.',
    '',
  ].join('\n')
}
