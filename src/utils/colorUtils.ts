// Small color helpers for the token editors. Hex validation + normalization;
// token references ({colors.primary}) are passed through untouched.

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/

export function isHexColor(value: string): boolean {
  return HEX_RE.test(value.trim())
}

export function isTokenReference(value: string): boolean {
  return /^\{[^}]+\}$/.test(value.trim())
}

/** A valid color token value is either a hex or a {token} reference. */
export function isValidColorValue(value: string): boolean {
  return isHexColor(value) || isTokenReference(value)
}

/** Normalize a 3-digit hex to 6 digits, lowercase. Leaves non-hex untouched. */
export function normalizeHex(value: string): string {
  const v = value.trim()
  if (!isHexColor(v)) return v
  if (v.length === 4) {
    return ('#' + v.slice(1).split('').map((c) => c + c).join('')).toLowerCase()
  }
  return v.toLowerCase()
}

// ── Color math for the custom picker ─────────────────────────────────────────

export interface RGBA {
  r: number // 0-255
  g: number
  b: number
  a: number // 0-1
}
export interface HSV {
  h: number // 0-360
  s: number // 0-1
  v: number // 0-1
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}
function h2(n: number): string {
  return clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0')
}

/** Parse a #rgb / #rrggbb / #rrggbbaa string to RGBA. Falls back to opaque black. */
export function hexToRgba(hex: string): RGBA {
  const v = normalizeHex(hex)
  const m = /^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/.exec(v)
  if (!m) return { r: 0, g: 0, b: 0, a: 1 }
  const n = parseInt(m[1], 16)
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255,
    a: m[2] === undefined ? 1 : parseInt(m[2], 16) / 255,
  }
}

/** RGBA → hex; emits #rrggbb when fully opaque, #rrggbbaa otherwise. */
export function rgbaToHex({ r, g, b, a }: RGBA): string {
  const base = `#${h2(r)}${h2(g)}${h2(b)}`
  return a >= 1 ? base : `${base}${h2(a * 255)}`
}

/** Parse a CSS `rgb(...)` / `rgba(...)` string (as getComputedStyle returns) to RGBA. */
export function parseCssColor(str: string): RGBA | null {
  const m = /^rgba?\(([^)]+)\)$/i.exec(str.trim())
  if (!m) return null
  const parts = m[1].split(/[,/]/).map((s) => parseFloat(s.trim()))
  if (parts.length < 3 || parts.some((n, i) => i < 3 && Number.isNaN(n))) return null
  return { r: parts[0], g: parts[1], b: parts[2], a: Number.isNaN(parts[3]) ? 1 : parts[3] ?? 1 }
}

export function rgbToHsv({ r, g, b }: RGBA): HSV {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6
    else if (max === gn) h = (bn - rn) / d + 2
    else h = (rn - gn) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s: max === 0 ? 0 : d / max, v: max }
}

export function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 }
}
