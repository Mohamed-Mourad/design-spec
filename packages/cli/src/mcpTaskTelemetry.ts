// mcpTaskTelemetry.ts — opt-in token counts from `design-spec serve`.
//
// Contract: design-spec-backend/docs/telemetry-contract.md (POST
// /api/v1/telemetry/mcp-tasks). After each MCP tool call, serve can report how
// many tokens it handed the agent, so the dashboard can show what scoped
// context saves against pasting the whole DESIGN.md.
//
// Off unless the developer sets DESIGN_SPEC_TELEMETRY=1 AND an API key
// resolves. Counts and ids only: a session id, the blueprint name, two token
// estimates and the client's name — never a tool argument, a tool result, or
// anything from the schema.
//
// A report is fire-and-forget. It is never awaited, never retried, and never
// writes to stdout (the MCP channel) or stderr; whatever happens to it, the
// tool call it describes has already been answered. The key goes in the
// Authorization header and nowhere else.

import { randomUUID } from 'node:crypto'
import { resolveCredentials } from './sync/credentials.js'

export interface McpToolCall {
  /** The blueprint the call resolved to, when it names one. */
  blueprint?: string
  /** The tool call's arguments, as text. */
  input: string
  /** What the tool returned, as text. */
  output: string
  /** The MCP client, as `name/version`. */
  client?: string
}

export interface McpTaskReporter {
  report(call: McpToolCall): void
}

const REPORT_TIMEOUT_MS = 5_000

const BLUEPRINT = /^[A-Za-z0-9][A-Za-z0-9 _-]{0,63}$/

/**
 * A token estimate from text length. serve has text, not a tokenizer; four
 * characters a token is the usual rule of thumb, and the baseline is estimated
 * the same way, so the two are comparable.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/** Reduce a client's self-reported name to what the API accepts as an id. */
export function clientId(name?: string, version?: string): string {
  const id = [name, version]
    .filter(Boolean)
    .join('/')
    .replace(/[^A-Za-z0-9 ._:/@-]/g, '')
    .replace(/^[^A-Za-z0-9]+/, '')
    .slice(0, 128)
  return id || 'unknown'
}

/**
 * The reporter for this serve session, or null when telemetry is off: no
 * opt-in, no key, a malformed key, or an API URL a key must not be sent to.
 * Deciding it is off is silent — a missing key is not an error here.
 */
export async function createMcpTaskReporter(fetchImpl: typeof fetch = fetch): Promise<McpTaskReporter | null> {
  if (process.env.DESIGN_SPEC_TELEMETRY !== '1') return null
  let creds
  try {
    creds = await resolveCredentials()
  } catch {
    return null
  }

  const url = `${creds.apiUrl}/api/v1/telemetry/mcp-tasks`
  const authorization = `Bearer ${creds.key}`
  // One serve process is one MCP session, which is what a "task" is here.
  const taskId = randomUUID()

  return {
    report(call) {
      try {
        const body = JSON.stringify({
          task_id: taskId,
          mode: 'mcp',
          ...(call.blueprint && BLUEPRINT.test(call.blueprint) ? { blueprint: call.blueprint } : {}),
          input_tokens: estimateTokens(call.input),
          output_tokens: estimateTokens(call.output),
          model: call.client ?? 'unknown',
        })
        void fetchImpl(url, {
          method: 'POST',
          headers: { Authorization: authorization, 'Content-Type': 'application/json' },
          body,
          signal: AbortSignal.timeout(REPORT_TIMEOUT_MS),
        }).then(
          (res) => void res.body?.cancel().catch(() => undefined),
          () => undefined,
        )
      } catch {
        // Telemetry never surfaces: not to the agent, not to the terminal.
      }
    },
  }
}
