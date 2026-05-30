// ui.ts — the ONLY module that writes to stdout/stderr.
//
// Every command renders through this object so style is consistent and output
// degrades correctly. Invariants it enforces:
//   - `--json`  → suppress ALL decoration; emit only the machine result (so
//                 `design-spec status --json | cat` is clean JSON).
//   - `--quiet` → errors only.
//   - non-TTY / CI / NO_COLOR / --no-color → no color, no spinner/animation;
//                 plain linear logs. FORCE_COLOR re-enables color.
//   - errors never dump a raw stack to users; stack only under --verbose/DEBUG.

import pc from 'picocolors'
import boxen from 'boxen'
import Table from 'cli-table3'
import ora, { type Ora } from 'ora'
import { Listr, type ListrTask } from 'listr2'
import { renderWordmark, wordmarkWidth } from './wordmark.js'

export interface UiMode {
  json: boolean
  quiet: boolean
  verbose: boolean
  color: boolean
}

interface UiState extends UiMode {
  /** True for an interactive terminal (animations allowed). */
  interactive: boolean
}

function detectColor(flagNoColor: boolean): boolean {
  if (flagNoColor) return false
  if (process.env.FORCE_COLOR && process.env.FORCE_COLOR !== '0') return true
  if (process.env.NO_COLOR) return false
  return Boolean(process.stdout.isTTY)
}

const state: UiState = {
  json: false,
  quiet: false,
  verbose: false,
  color: detectColor(false),
  interactive: Boolean(process.stdout.isTTY) && !process.env.CI,
}

// A colorizer that honors the resolved color mode regardless of picocolors' own
// auto-detection (we want a single switch).
let c = pc.createColors(state.color)

/** Configure UI from the parsed global flags. Call once, early. */
export function configureUi(opts: Partial<UiMode> & { noColor?: boolean }): void {
  if (opts.json !== undefined) state.json = opts.json
  if (opts.quiet !== undefined) state.quiet = opts.quiet
  if (opts.verbose !== undefined) state.verbose = opts.verbose
  state.color = detectColor(Boolean(opts.noColor))
  // JSON mode and non-interactive contexts never animate.
  state.interactive = Boolean(process.stdout.isTTY) && !process.env.CI && !state.json
  c = pc.createColors(state.color)
}

export function uiMode(): Readonly<UiState> {
  return state
}

// Status glyphs — chosen so they can NEVER render as a color emoji.
//
// The trap: ✔ (U+2714), ✖ (U+2716), ⚠ (U+26A0), ℹ (U+2139) are all in the
// Unicode *emoji* set, so terminals/fonts (and apps like WhatsApp) may show
// them as full-color emoji — and the U+FE0E text selector is widely ignored.
// We therefore use only code points that are NOT emoji at all:
//   ✓ U+2713, ✗ U+2717 (check/cross, text-only), and plain ASCII for info/warn.
// Color (the actual signal) is applied separately via picocolors.
// A terminal is a text grid — raster icons/SVGs can't render portably here.
const SYMBOLS = {
  info: 'i',
  success: '✓',
  warning: '!',
  error: '✗',
  arrow: '→',
} as const

function out(line: string): void {
  if (state.json) return
  process.stdout.write(line + '\n')
}
function err(line: string): void {
  process.stderr.write(line + '\n')
}

// ── Plain messages ────────────────────────────────────────────────────────────

export function info(msg: string): void {
  if (state.quiet) return
  out(`${c.blue(SYMBOLS.info)} ${msg}`)
}

export function success(msg: string): void {
  if (state.quiet) return
  out(`${c.green(SYMBOLS.success)} ${msg}`)
}

export function warn(msg: string): void {
  if (state.quiet) return
  out(`${c.yellow(SYMBOLS.warning)} ${msg}`)
}

export function note(msg: string): void {
  if (state.quiet || !state.verbose) return
  out(c.dim(msg))
}

export function debug(msg: string): void {
  if (!state.verbose && !process.env.DEBUG) return
  err(c.dim(`[debug] ${msg}`))
}

/**
 * Render an actionable error to stderr. Never prints a raw stack to users; the
 * stack appears only under --verbose/DEBUG.
 */
export function error(message: string, opts: { code?: string; hint?: string; cause?: unknown } = {}): void {
  if (state.json) return // the command emits a structured error via json()
  const head = `${c.red(SYMBOLS.error)} ${message}${opts.code ? c.dim(` (${opts.code})`) : ''}`
  err(head)
  if (opts.hint) err(`  ${c.dim(SYMBOLS.arrow)} ${c.dim(opts.hint)}`)
  if ((state.verbose || process.env.DEBUG) && opts.cause instanceof Error && opts.cause.stack) {
    err(c.dim(opts.cause.stack))
  }
}

// ── Structured machine output ──────────────────────────────────────────────────

/** Emit the machine-readable result. In --json mode this is the ONLY stdout. */
export function json(value: unknown): void {
  if (!state.json) return
  process.stdout.write(JSON.stringify(value, null, 2) + '\n')
}

// ── Rich rendering (auto-degrades) ─────────────────────────────────────────────

/**
 * Branded wordmark. A single solid accent color in bold — deliberately NOT a
 * gradient (rainbow/gradient CLI banners are an overused AI-generated tell).
 * Suppressed in json/quiet; plain text when color is off.
 */
export function banner(word: string, subtitle?: string): void {
  if (state.json || state.quiet) return
  if (!state.color) {
    out(word + (subtitle ? `\n${subtitle}` : ''))
    return
  }
  out(c.bold(c.cyan(word)))
  if (subtitle) out(c.dim(subtitle))
}

export interface SplashInfo {
  version: string
  cwd: string
  /** Contextual one-liner for the top tip box. */
  tip: string
  /** Status line under the wordmark (e.g. detected schema). */
  status: string
  /** Bottom hint (key commands). */
  hints: string
}

/**
 * The launch splash for a bare `design-spec` invocation: a contextual tip box,
 * the block wordmark in a solid accent, version + cwd, a status line, and a
 * command hint. Shown only in an interactive TTY; callers must skip it for
 * json/quiet/non-TTY (a bare run there should print plain help instead).
 */
export function splash(info: SplashInfo): void {
  if (state.json || state.quiet) return

  // Tip box at the top (full-width-ish), like Stakpak's onboarding hint.
  out(
    boxen(state.color ? c.cyan(info.tip) : info.tip, {
      padding: { top: 0, bottom: 0, left: 1, right: 1 },
      borderColor: state.color ? 'cyan' : undefined,
      borderStyle: 'round',
      margin: { top: 0, bottom: 1, left: 0, right: 0 },
    }),
  )

  // Wordmark — block art when it fits and color is on; else the bold text mark.
  const cols = process.stdout.columns ?? 80
  if (state.color && cols >= wordmarkWidth() + 2) {
    for (const line of renderWordmark()) out(c.cyan(line))
  } else {
    out(c.bold(state.color ? c.cyan('design-spec') : 'design-spec'))
  }

  out('')
  out(`${c.dim('version:')} ${info.version}`)
  out(`${c.dim('cwd:')}     ${info.cwd}`)
  out('')
  out(info.status)
  out(c.dim(info.hints))
}

/** A boxed summary. Degrades to a plain block when color/box is unavailable. */
export function box(title: string, lines: string[]): void {
  if (state.json || state.quiet) return
  const body = lines.join('\n')
  if (!state.color) {
    out(`\n${title}\n${body}\n`)
    return
  }
  out(
    boxen(body, {
      title,
      titleAlignment: 'left',
      padding: 1,
      borderColor: 'blue',
      borderStyle: 'round',
    }),
  )
}

/** A bordered table. Degrades to tab-separated rows when piped/no-color. */
export function table(head: string[], rows: string[][]): void {
  if (state.json || state.quiet) return
  if (!state.color || !state.interactive) {
    out([head.join('\t'), ...rows.map((r) => r.join('\t'))].join('\n'))
    return
  }
  const t = new Table({ head, style: { head: ['cyan'] } })
  rows.forEach((r) => t.push(r))
  out(t.toString())
}

/**
 * A single async step with a spinner. Falls back to plain start/done logs when
 * non-interactive. Returns the operation's result.
 */
export async function spin<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (state.json || !state.interactive) {
    if (!state.quiet && !state.json) info(label)
    return fn()
  }
  const sp: Ora = ora({ text: label, stream: process.stderr }).start()
  try {
    const result = await fn()
    // stopAndPersist with our own glyph — ora's .succeed/.fail use log-symbols'
    // emoji-prone ✔/✖. Keep the whole CLI on the non-emoji set.
    sp.stopAndPersist({ symbol: c.green(SYMBOLS.success), text: label })
    return result
  } catch (e) {
    sp.stopAndPersist({ symbol: c.red(SYMBOLS.error), text: label })
    throw e
  }
}

/**
 * A live status handle for terminal-resident commands (e.g. `watch`). The glyph
 * animates continuously (the command IS actively running), but flicker-free:
 * each frame is written in place with `\r` + padding and the cursor is hidden,
 * so we never clear-to-blank the line (the cause of ora's flicker on Windows
 * conhost). `done`/`fail` persist a `✓`/`✗` line above the live line. In
 * json/non-TTY/CI it degrades to plain one-shot logs (no animation can hang CI).
 */
export interface Spinner {
  /** Swap the live status text (e.g. idle → "Recompiling…"). */
  begin(text: string): void
  /** Persist a completed line (✓ + text); the live line keeps animating. */
  done(text: string): void
  /** Persist a failure line (✗ + text); the live line keeps animating. */
  fail(text: string): void
  /** Stop animating, restore the cursor, clear the live line. */
  stop(): void
}

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

export function spinner(idleText: string): Spinner {
  if (state.json || state.quiet || !state.interactive) {
    // No animation when piped/CI/json — it would never terminate and would
    // corrupt the stream. Announce once, then log persisted lines as they come.
    if (!state.json && !state.quiet) info(idleText)
    return { begin: () => {}, done: (t) => success(t), fail: (t) => error(t), stop: () => {} }
  }

  let text = idleText
  let frame = 0
  let lastLen = 0

  const writeLive = (): void => {
    const glyph = c.cyan(SPINNER_FRAMES[frame])
    const visibleLen = 2 + text.length // glyph + space + text (text is plain)
    // Overwrite in place; pad with spaces to cover a previously longer line.
    // No clear-to-EOL escape → no blank frame → no flicker.
    let line = `\r${glyph} ${text}`
    if (visibleLen < lastLen) line += ' '.repeat(lastLen - visibleLen)
    lastLen = visibleLen
    process.stderr.write(line)
    frame = (frame + 1) % SPINNER_FRAMES.length
  }

  // Persist a finished line ABOVE the live line: blank the live line, write the
  // persisted line + newline, then let the next tick repaint the live line.
  const persist = (symbol: string, msg: string): void => {
    process.stderr.write('\r' + ' '.repeat(lastLen) + '\r')
    lastLen = 0
    process.stderr.write(`${symbol} ${msg}\n`)
  }

  process.stderr.write('\x1B[?25l') // hide cursor (prevents cursor flicker)
  writeLive()
  const timer = setInterval(writeLive, 90)
  timer.unref?.() // don't keep the event loop alive on its own

  return {
    begin: (t) => {
      text = t
    },
    done: (t) => {
      persist(c.green(SYMBOLS.success), t)
      text = idleText
    },
    fail: (t) => {
      persist(c.red(SYMBOLS.error), t)
      text = idleText
    },
    stop: () => {
      clearInterval(timer)
      process.stderr.write('\r' + ' '.repeat(lastLen) + '\r')
      process.stderr.write('\x1B[?25h') // restore cursor
    },
  }
}

export interface Step<Ctx = unknown> {
  title: string
  task: ListrTask<Ctx>['task']
}

/**
 * A multi-step task list (spinner → done/fail per step). Uses the listr2 simple
 * renderer when non-interactive so CI/piped logs stay linear and clean.
 */
export async function tasks<Ctx extends object>(steps: Step<Ctx>[], ctx?: Ctx): Promise<Ctx> {
  // json mode renders nothing; non-interactive uses the linear "simple"
  // renderer; an interactive terminal gets the animated "default" renderer.
  // Branches are kept separate so each renderer literal types cleanly.
  // Both listr2 renderers default to figures.tick/figures.cross (✔/✖), which are
  // emoji code points — override them with our non-emoji glyphs on every branch.
  const icon = { COMPLETED: SYMBOLS.success, FAILED: SYMBOLS.error }
  if (state.json) return new Listr<Ctx, 'silent'>(steps, { renderer: 'silent', ctx }).run()
  if (!state.interactive)
    return new Listr<Ctx, 'simple'>(steps, { renderer: 'simple', ctx, rendererOptions: { icon } }).run()
  return new Listr<Ctx, 'default'>(steps, { renderer: 'default', ctx, rendererOptions: { icon } }).run()
}
