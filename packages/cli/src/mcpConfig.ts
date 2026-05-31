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
  return { command: nodePath, args: [scriptPath, 'serve'], label: `node ${scriptPath} serve` }
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

function commandLine(inv: Invocation): string {
  return [inv.command, ...inv.args].map(shellQuote).join(' ')
}

/** The `claude mcp add` one-liner (Claude Code CLI). */
export function claudeCodeAddCommand(inv: Invocation): string {
  return `claude mcp add design-spec -- ${commandLine(inv)}`
}

/** The MCP Inspector command — the fastest zero-client way to click the tools. */
export function inspectorCommand(inv: Invocation): string {
  return `npx @modelcontextprotocol/inspector ${commandLine(inv)}`
}

/** Short, friendly lines for the TTY splash — points at the two easiest paths. */
export function connectHints(inv: Invocation): string[] {
  return [
    'This is an MCP server — connect an AI tool to it, don\'t type here.',
    '',
    'Fastest test (opens a UI in your browser, no setup):',
    `  ${inspectorCommand(inv)}`,
    '',
    'Connect Claude Code:',
    `  ${claudeCodeAddCommand(inv)}`,
    '',
    'Claude Desktop / Cursor / Windsurf: paste the JSON config from',
    '  design-spec serve --print-config',
  ]
}

/** Full copy-paste setup printed by `serve --print-config` (goes to stdout). */
export function printableConfig(inv: Invocation, cwd: string): string {
  const json = mcpServersJson(inv, cwd)
  return [
    '# Connect an AI tool to this design system over MCP',
    '',
    `Detected invocation: ${inv.label}`,
    `Project (cwd):       ${cwd}`,
    '',
    '────────────────────────────────────────────────────────',
    'Quick test — no client needed (opens a browser UI):',
    '',
    `  ${inspectorCommand(inv)}`,
    '',
    'In the Inspector: Connect → Tools → get_component_tokens',
    '  with input {"component":"Button"}.',
    '',
    '────────────────────────────────────────────────────────',
    'Claude Code (CLI) — one command, run in this folder:',
    '',
    `  ${claudeCodeAddCommand(inv)}`,
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
