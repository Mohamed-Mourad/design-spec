// extract/color.ts — normalize any CSS color notation a repo might use into the
// schema's one representation: sRGB hex.
//
// Pure and deterministic. Scanned repos write colors as hex, `rgb()`, `hsl()`,
// bare channel triplets (the Tailwind v3 `<alpha-value>` convention), and — in
// anything built on Tailwind v4 — `oklch()`. All of them have to land on the
// same `#RRGGBB` so nearestColorToken and the compilers see one value type.
// Alpha is parsed but dropped: schema colors are opaque sRGB, per spec.md.

import type { ColorValue } from '../types/schema.js'

const HEX_RE = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const NUM = String.raw`[-+]?(?:\d*\.\d+|\d+)`
const RGB_RE = new RegExp(
  String.raw`^rgba?\(\s*(${NUM})(%?)[\s,]+(${NUM})(%?)[\s,]+(${NUM})(%?)\s*(?:[,/][^)]*)?\)$`,
  'i',
)
const HSL_RE = new RegExp(
  String.raw`^hsla?\(\s*(${NUM})(?:deg|grad|rad|turn)?[\s,]+(${NUM})%?[\s,]+(${NUM})%?\s*(?:[,/][^)]*)?\)$`,
  'i',
)
const OKLCH_RE = new RegExp(
  String.raw`^oklch\(\s*(${NUM})(%?)[\s,]+(${NUM})(%?)[\s,]+(${NUM})(?:deg|grad|rad|turn)?\s*(?:[,/][^)]*)?\)$`,
  'i',
)
/** Bare `37 99 235` / `37, 99, 235` — a `rgb(var(--x))` channel triplet. */
const TRIPLET_RE = new RegExp(String.raw`^(${NUM})[\s,]+(${NUM})[\s,]+(${NUM})$`)
/**
 * Bare `222.2 47.4% 11.2%` — the shadcn/ui convention: an HSL triplet stored
 * raw so themes can compose it as `hsl(var(--primary) / <alpha>)`. The two
 * percent signs disambiguate it from an RGB channel triplet.
 */
const HSL_TRIPLET_RE = new RegExp(String.raw`^(${NUM})(?:deg)?[\s,]+(${NUM})%[\s,]+(${NUM})%$`)

/** Values that are legal CSS colors but carry no extractable value. */
const NON_VALUES = new Set([
  'transparent',
  'currentcolor',
  'inherit',
  'initial',
  'unset',
  'revert',
  'none',
  'auto',
])

function clamp255(n: number): number {
  return Math.min(255, Math.max(0, Math.round(n)))
}

function toHex(r: number, g: number, b: number): ColorValue {
  const h = (n: number) => clamp255(n).toString(16).padStart(2, '0').toUpperCase()
  return `#${h(r)}${h(g)}${h(b)}` as ColorValue
}

function expandHex(raw: string): ColorValue | null {
  const h = raw.slice(1)
  // Drop the alpha nibble/byte — schema colors are opaque.
  if (h.length === 3 || h.length === 4) {
    const [r, g, b] = h.slice(0, 3).split('')
    return `#${(r + r + g + g + b + b).toUpperCase()}` as ColorValue
  }
  return `#${h.slice(0, 6).toUpperCase()}` as ColorValue
}

/** `h` in degrees, `s`/`l` as 0–100. */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hn = ((h % 360) + 360) % 360
  const sn = Math.min(100, Math.max(0, s)) / 100
  const ln = Math.min(100, Math.max(0, l)) / 100
  const c = (1 - Math.abs(2 * ln - 1)) * sn
  const x = c * (1 - Math.abs(((hn / 60) % 2) - 1))
  const m = ln - c / 2
  const seg = Math.floor(hn / 60) % 6
  const rgb: [number, number, number][] = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ]
  const [r, g, b] = rgb[seg]
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255]
}

/** Linear-light channel (0–1) → sRGB 0–255, per the sRGB transfer function. */
function linearToSrgb(c: number): number {
  const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
  return v * 255
}

/**
 * Oklch → sRGB. `l` 0–1, `c` chroma, `h` degrees. Uses the Ottosson matrices
 * (Oklab → linear sRGB), then gamma-encodes. Out-of-gamut results clamp per
 * channel, which is what every browser does for an unrenderable oklch.
 */
function oklchToRgb(l: number, c: number, h: number): [number, number, number] {
  const hr = (h * Math.PI) / 180
  const a = c * Math.cos(hr)
  const b = c * Math.sin(hr)

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b
  const s_ = l - 0.0894841775 * a - 1.291485548 * b

  const L = l_ * l_ * l_
  const M = m_ * m_ * m_
  const S = s_ * s_ * s_

  const r = +4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S
  const g = -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S
  const bl = -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S

  return [linearToSrgb(r), linearToSrgb(g), linearToSrgb(bl)]
}

function pct(value: string, isPct: string, scale: number): number {
  const n = Number(value)
  return isPct ? (n / 100) * scale : n
}

/**
 * Normalize any supported CSS color notation to `#RRGGBB`, or null when the
 * value is not a resolvable color (a keyword, a `var()` alias, a gradient, a
 * notation we deliberately don't guess at).
 */
export function normalizeColor(raw: string): ColorValue | null {
  const v = raw.trim().replace(/\s*!important$/i, '')
  if (v === '' || NON_VALUES.has(v.toLowerCase())) return null
  // A `var()` alias resolves at CSS runtime, not here.
  if (/^var\(/i.test(v)) return null

  if (HEX_RE.test(v)) return expandHex(v)

  const rgb = RGB_RE.exec(v)
  if (rgb) {
    return toHex(
      pct(rgb[1], rgb[2], 255),
      pct(rgb[3], rgb[4], 255),
      pct(rgb[5], rgb[6], 255),
    )
  }

  const hsl = HSL_RE.exec(v)
  if (hsl) {
    const [r, g, b] = hslToRgb(Number(hsl[1]), Number(hsl[2]), Number(hsl[3]))
    return toHex(r, g, b)
  }

  const ok = OKLCH_RE.exec(v)
  if (ok) {
    const l = ok[2] ? Number(ok[1]) / 100 : Number(ok[1])
    // Chroma as a percentage is relative to 0.4 (the CSS Color 4 reference).
    const c = ok[4] ? (Number(ok[3]) / 100) * 0.4 : Number(ok[3])
    const [r, g, b] = oklchToRgb(l, c, Number(ok[5]))
    return toHex(r, g, b)
  }

  const hslTrip = HSL_TRIPLET_RE.exec(v)
  if (hslTrip) {
    const [r, g, b] = hslToRgb(Number(hslTrip[1]), Number(hslTrip[2]), Number(hslTrip[3]))
    return toHex(r, g, b)
  }

  const trip = TRIPLET_RE.exec(v)
  if (trip) {
    const nums = [Number(trip[1]), Number(trip[2]), Number(trip[3])]
    // Only treat a bare triplet as a color when it reads like 0–255 channels;
    // `0 0 0` would otherwise swallow a shadow offset.
    if (nums.every((n) => Number.isFinite(n) && n >= 0 && n <= 255)) {
      return toHex(nums[0], nums[1], nums[2])
    }
  }

  return null
}

/** True when `raw` is a color this module can resolve to hex. */
export function isColorValue(raw: string): boolean {
  return normalizeColor(raw) !== null
}
