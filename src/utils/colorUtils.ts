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
