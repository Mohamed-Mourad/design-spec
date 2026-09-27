// flutter/values.ts — schema value → Dart literal conversion.
//
// Flutter has no CSS units: every length is a logical-pixel double. `rem`/`em`
// are taken against a 16px root, matching the browser default the web targets
// assume. Pure, deterministic; numbers are rounded to 4 dp so the output is
// byte-stable across float quirks.

const ROOT_PX = 16

/** Format a number as a Dart numeric literal (no float noise, no trailing zeros). */
export function num(n: number): string {
  const r = Number(n.toFixed(4))
  return Object.is(r, -0) ? '0' : String(r)
}

/** A dimension (`16px`, `1.5rem`, `0`, `12`) in logical pixels, or null if not a length. */
export function toPx(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null
  const m = value.trim().match(/^(-?\d*\.?\d+)(px|rem|em)?$/)
  if (!m) return null
  const n = parseFloat(m[1])
  return m[2] === 'rem' || m[2] === 'em' ? n * ROOT_PX : n
}

/** `#2563EB` / `#26E` → `0xFF2563EB`; null if not a hex color. Optional alpha 0..1. */
export function hexToArgb(hex: string, alpha = 1): string | null {
  const m = hex.trim().match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
  if (!m) return null
  const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1]
  return `0x${alphaByte(alpha)}${h.toUpperCase()}`
}

function alphaByte(a: number): string {
  const clamped = Math.min(1, Math.max(0, a))
  return Math.round(clamped * 255).toString(16).toUpperCase().padStart(2, '0')
}

/** `#2563EB` → `Color(0xFF2563EB)`, or null. */
export function colorLiteral(hex: string): string | null {
  const argb = hexToArgb(hex)
  return argb ? `Color(${argb})` : null
}

/** Parse a CSS color (`#hex`, `rgb()`, `rgba()`) to a Dart `Color(…)`, or null. */
function cssColor(token: string): string | null {
  if (token.startsWith('#')) return colorLiteral(token)
  const m = token.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/i)
  if (!m) return null
  const [r, g, b] = [m[1], m[2], m[3]].map((c) => Math.min(255, Math.round(parseFloat(c))))
  let a = 1
  if (m[4] !== undefined) a = m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4])
  const hex = [r, g, b].map((c) => c.toString(16).toUpperCase().padStart(2, '0')).join('')
  return `Color(0x${alphaByte(a)}${hex})`
}

/** Split on a separator, ignoring separators inside parentheses. */
function splitTop(s: string, sep: RegExp): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of s) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (depth === 0 && sep.test(ch)) {
      if (cur.trim()) out.push(cur.trim())
      cur = ''
    } else {
      cur += ch
    }
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

export interface ShadowLayers {
  /** `BoxShadow(...)` expressions for the layers Flutter can express. */
  layers: string[]
  /** Layers dropped (inset, unparseable) — surfaced as a comment. */
  dropped: string[]
}

/**
 * CSS `box-shadow` (one string with comma-separated layers, or an array of
 * layers) → Flutter `BoxShadow`s. `inset` has no BoxShadow equivalent and is
 * dropped with a note rather than silently approximated.
 */
export function parseShadow(value: string | string[], inset = false): ShadowLayers {
  const raw = Array.isArray(value) ? value.flatMap((v) => splitTop(v, /,/)) : splitTop(value, /,/)
  const layers: string[] = []
  const dropped: string[] = []
  for (const layer of raw) {
    const parts = splitTop(layer, /\s/)
    if (inset || parts.includes('inset')) {
      dropped.push(layer)
      continue
    }
    const lengths: number[] = []
    let color: string | null = 'Color(0x40000000)' // CSS default is currentColor; use a neutral 25% black
    let ok = true
    for (const p of parts) {
      const px = toPx(p)
      if (px !== null) lengths.push(px)
      else {
        const c = cssColor(p)
        if (c) color = c
        else ok = false
      }
    }
    if (!ok || lengths.length < 2 || lengths.length > 4) {
      dropped.push(layer)
      continue
    }
    const [x, y, blur = 0, spread = 0] = lengths
    layers.push(
      `BoxShadow(color: ${color}, offset: Offset(${num(x)}, ${num(y)}), blurRadius: ${num(blur)}, spreadRadius: ${num(spread)})`,
    )
  }
  return { layers, dropped }
}

/** Escape a string for a single-quoted Dart literal. */
export function dartString(s: string): string {
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\$/g, '\\$')}'`
}
