// wordmark.ts — the block-letter wordmark, pre-rendered (no figlet dependency).
//
// A small 5-row block font covering exactly the glyphs in "DESIGN SPEC". Kept
// as data so the splash renders instantly and deterministically; color is
// applied by the caller (never a gradient — solid accent only).

const ROWS = 5

// Each glyph is 5 rows tall; columns vary. Built from full blocks.
const FONT: Record<string, string[]> = {
  D: ['████ ', '█   █', '█   █', '█   █', '████ '],
  E: ['█████', '█    ', '████ ', '█    ', '█████'],
  S: ['█████', '█    ', '█████', '    █', '█████'],
  I: ['█', '█', '█', '█', '█'],
  G: ['█████', '█    ', '█  ██', '█   █', '█████'],
  N: ['█   █', '██  █', '█ █ █', '█  ██', '█   █'],
  P: ['████ ', '█   █', '████ ', '█    ', '█    '],
  C: ['█████', '█    ', '█    ', '█    ', '█████'],
  ' ': ['  ', '  ', '  ', '  ', '  '],
}

const GAP = '  ' // space between glyphs

/** Render `text` (uppercased) in the block font. Returns ROWS lines, no color. */
export function renderWordmark(text = 'DESIGN SPEC'): string[] {
  const chars = [...text.toUpperCase()].filter((ch) => ch in FONT)
  const lines: string[] = []
  for (let r = 0; r < ROWS; r++) {
    lines.push(chars.map((ch) => FONT[ch][r]).join(GAP))
  }
  return lines
}

/** Visible width of the rendered wordmark (longest row). */
export function wordmarkWidth(text = 'DESIGN SPEC'): number {
  return Math.max(...renderWordmark(text).map((l) => l.length))
}
