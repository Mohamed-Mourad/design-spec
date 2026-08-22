// extract/staticJs.ts — read a JS/TS config's exported object WITHOUT evaluating it.
//
// The cloud retrofit scanner may never execute repository code (that is a hard
// security invariant — `dynamic import()` is CLI-only, on the developer's own
// machine). So this is a small recursive-descent reader over literal syntax:
// objects, arrays, strings, numbers, booleans, null, and substitution-free
// template literals.
//
// The important behaviour is what it does when it hits something it cannot
// evaluate — an imported identifier, a `{...spread}`, `process.env.X`, a
// `definePreset(...)` call. It does NOT abandon the parse. It records that one
// property path in `unparseable` and skips exactly that value, keeping every
// statically safe sibling. That is the "isolate only the unparseable layers"
// half of Smart Fallback; the compiled-CSS read is the other half.
//
// Pure and deterministic. Bounded: source length, nesting depth, and node count
// are all capped so a pathological or minified file can never wedge the scan.

export type JsValue = string | number | boolean | null | JsValue[] | { [key: string]: JsValue }

export interface StaticParseResult {
  /** The exported object with unparseable properties omitted; null if unreadable. */
  value: Record<string, JsValue> | null
  /** Dotted paths whose values could not be statically evaluated. */
  unparseable: string[]
  /** Why the whole parse failed. Set only when `value` is null. */
  error?: string
}

const MAX_SOURCE = 2 * 1024 * 1024 // 2 MiB
const MAX_DEPTH = 32
const MAX_NODES = 50_000

/** Sentinel for "syntactically present, not statically evaluable". */
const OPAQUE = Symbol('opaque')
type Parsed = JsValue | typeof OPAQUE

const IDENT_START = /[A-Za-z_$]/
const IDENT_PART = /[A-Za-z0-9_$]/

class Reader {
  readonly src: string
  pos = 0
  nodes = 0
  readonly unparseable: string[] = []
  /** 1 where the source character sits inside a comment or a string literal. */
  mask: Uint8Array | null = null

  constructor(src: string) {
    this.src = src
  }

  get done(): boolean {
    return this.pos >= this.src.length
  }

  peek(offset = 0): string {
    return this.src[this.pos + offset] ?? ''
  }

  /** Skip whitespace and both comment forms. */
  skipTrivia(): void {
    for (;;) {
      const c = this.peek()
      if (c === '' ) return
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\f' || c === '\v') {
        this.pos++
        continue
      }
      if (c === '/' && this.peek(1) === '/') {
        while (!this.done && this.peek() !== '\n') this.pos++
        continue
      }
      if (c === '/' && this.peek(1) === '*') {
        this.pos += 2
        while (!this.done && !(this.peek() === '*' && this.peek(1) === '/')) this.pos++
        this.pos += 2
        continue
      }
      return
    }
  }

  budget(): void {
    if (++this.nodes > MAX_NODES) throw new RangeError('node budget exceeded')
  }
}

/** Consume a quoted string starting at the opening quote. */
function readString(r: Reader): string {
  const quote = r.src[r.pos]
  r.pos++
  let out = ''
  while (!r.done) {
    const c = r.src[r.pos]
    if (c === '\\') {
      out += unescape(r)
      continue
    }
    if (c === quote) {
      r.pos++
      return out
    }
    out += c
    r.pos++
  }
  throw new SyntaxError('unterminated string')
}

const ESCAPES: Record<string, string> = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', '0': '\0' }

function unescape(r: Reader): string {
  r.pos++ // the backslash
  const c = r.src[r.pos]
  if (c === undefined) throw new SyntaxError('trailing escape')
  r.pos++
  if (c === 'u') {
    if (r.peek() === '{') {
      const end = r.src.indexOf('}', r.pos)
      if (end === -1) throw new SyntaxError('bad unicode escape')
      const code = parseInt(r.src.slice(r.pos + 1, end), 16)
      r.pos = end + 1
      return Number.isFinite(code) ? String.fromCodePoint(code) : ''
    }
    const code = parseInt(r.src.slice(r.pos, r.pos + 4), 16)
    r.pos += 4
    return Number.isFinite(code) ? String.fromCharCode(code) : ''
  }
  if (c === 'x') {
    const code = parseInt(r.src.slice(r.pos, r.pos + 2), 16)
    r.pos += 2
    return Number.isFinite(code) ? String.fromCharCode(code) : ''
  }
  return ESCAPES[c] ?? c
}

/**
 * Consume a template literal. Returns its text when it has no substitutions;
 * OPAQUE when it interpolates (the value depends on runtime state).
 */
function readTemplate(r: Reader): Parsed {
  r.pos++ // opening backtick
  let out = ''
  let interpolated = false
  while (!r.done) {
    const c = r.src[r.pos]
    if (c === '\\') {
      out += unescape(r)
      continue
    }
    if (c === '`') {
      r.pos++
      return interpolated ? OPAQUE : out
    }
    if (c === '$' && r.peek(1) === '{') {
      interpolated = true
      r.pos += 2
      skipBalanced(r, '{', '}', 1)
      continue
    }
    out += c
    r.pos++
  }
  throw new SyntaxError('unterminated template literal')
}

function readNumber(r: Reader): number {
  const start = r.pos
  if (r.peek() === '-' || r.peek() === '+') r.pos++
  if (r.peek() === '0' && /[xXbBoO]/.test(r.peek(1))) {
    r.pos += 2
    while (/[0-9a-fA-F_]/.test(r.peek())) r.pos++
    return Number(r.src.slice(start, r.pos).replace(/_/g, ''))
  }
  while (/[0-9_]/.test(r.peek())) r.pos++
  if (r.peek() === '.') {
    r.pos++
    while (/[0-9_]/.test(r.peek())) r.pos++
  }
  if (/[eE]/.test(r.peek())) {
    r.pos++
    if (r.peek() === '-' || r.peek() === '+') r.pos++
    while (/[0-9]/.test(r.peek())) r.pos++
  }
  const n = Number(r.src.slice(start, r.pos).replace(/_/g, ''))
  if (!Number.isFinite(n)) throw new SyntaxError('bad number')
  return n
}

function readIdentifier(r: Reader): string {
  const start = r.pos
  if (!IDENT_START.test(r.peek())) throw new SyntaxError('expected identifier')
  r.pos++
  while (IDENT_PART.test(r.peek())) r.pos++
  return r.src.slice(start, r.pos)
}

/**
 * Advance past a bracketed region, `depth` levels already open. Strings,
 * templates, and comments inside are skipped, not interpreted.
 */
function skipBalanced(r: Reader, open: string, close: string, depth: number): void {
  while (!r.done && depth > 0) {
    const c = r.peek()
    if (c === '"' || c === "'") {
      readString(r)
      continue
    }
    if (c === '`') {
      readTemplate(r)
      continue
    }
    if (c === '/' && (r.peek(1) === '/' || r.peek(1) === '*')) {
      r.skipTrivia()
      continue
    }
    if (c === open) depth++
    else if (c === close) depth--
    r.pos++
  }
}

/** Skip one whole value, however complex, leaving `pos` just past it. */
function skipValue(r: Reader): void {
  r.skipTrivia()
  let depth = 0
  while (!r.done) {
    const c = r.peek()
    if (c === '"' || c === "'") {
      readString(r)
      continue
    }
    if (c === '`') {
      readTemplate(r)
      continue
    }
    if (c === '/' && (r.peek(1) === '/' || r.peek(1) === '*')) {
      r.skipTrivia()
      continue
    }
    if (c === '{' || c === '[' || c === '(') {
      depth++
      r.pos++
      continue
    }
    if (c === '}' || c === ']' || c === ')') {
      if (depth === 0) return // belongs to the enclosing structure
      depth--
      r.pos++
      continue
    }
    if (c === ',' && depth === 0) return
    r.pos++
  }
}

function parseValue(r: Reader, path: string, depth: number): Parsed {
  r.budget()
  if (depth > MAX_DEPTH) throw new RangeError('nesting too deep')
  r.skipTrivia()
  const c = r.peek()

  if (c === '{') return parseObject(r, path, depth)
  if (c === '[') return parseArray(r, path, depth)
  if (c === '"' || c === "'") return readString(r)
  if (c === '`') return readTemplate(r)
  if (/[0-9]/.test(c) || ((c === '-' || c === '+') && /[0-9.]/.test(r.peek(1))) || (c === '.' && /[0-9]/.test(r.peek(1)))) {
    return readNumber(r)
  }

  if (IDENT_START.test(c)) {
    const save = r.pos
    const id = readIdentifier(r)
    r.skipTrivia()
    // A bare keyword is a literal only when nothing follows it — `true,` yes,
    // `theme.colors` or `definePreset(` no.
    const next = r.peek()
    const isBare = next === ',' || next === '}' || next === ']' || next === ')' || next === '' || next === ';'
    if (isBare) {
      if (id === 'true') return true
      if (id === 'false') return false
      if (id === 'null') return null
      if (id === 'undefined') return null
    }
    r.pos = save
    skipValue(r)
    return OPAQUE
  }

  skipValue(r)
  return OPAQUE
}

function parseArray(r: Reader, path: string, depth: number): Parsed {
  r.pos++ // [
  const out: JsValue[] = []
  for (;;) {
    r.skipTrivia()
    if (r.done) throw new SyntaxError('unterminated array')
    if (r.peek() === ']') {
      r.pos++
      return out
    }
    if (r.peek() === ',') {
      r.pos++
      continue
    }
    if (r.peek() === '.' && r.peek(1) === '.' && r.peek(2) === '.') {
      r.pos += 3
      skipValue(r)
      r.unparseable.push(`${path}[...spread]`)
      continue
    }
    const v = parseValue(r, `${path}[${out.length}]`, depth + 1)
    if (v === OPAQUE) r.unparseable.push(`${path}[${out.length}]`)
    else out.push(v)
  }
}

function parseObject(r: Reader, path: string, depth: number): Record<string, JsValue> {
  r.pos++ // {
  const out: Record<string, JsValue> = {}
  for (;;) {
    r.skipTrivia()
    if (r.done) throw new SyntaxError('unterminated object')
    const c = r.peek()
    if (c === '}') {
      r.pos++
      return out
    }
    if (c === ',' || c === ';') {
      r.pos++
      continue
    }

    // `...base` / `...require('x')` — the whole layer is opaque, siblings survive.
    if (c === '.' && r.peek(1) === '.' && r.peek(2) === '.') {
      r.pos += 3
      const from = r.pos
      skipValue(r)
      r.unparseable.push(`${path ? `${path}.` : ''}...${r.src.slice(from, r.pos).trim().slice(0, 40)}`)
      continue
    }

    // Key: identifier, string, number, or a computed `[expr]` we can't name.
    let key: string
    if (c === '"' || c === "'") key = readString(r)
    else if (c === '[') {
      const start = r.pos
      r.pos++
      skipBalanced(r, '[', ']', 1)
      const expr = r.src.slice(start, r.pos)
      r.skipTrivia()
      if (r.peek() === ':') {
        r.pos++
        skipValue(r)
      }
      r.unparseable.push(`${path ? `${path}.` : ''}${expr}`)
      continue
    } else if (/[0-9]/.test(c)) key = String(readNumber(r))
    else if (IDENT_START.test(c)) key = readIdentifier(r)
    else {
      // Something unexpected at key position — bail out of this object cleanly.
      skipValue(r)
      continue
    }

    const childPath = path ? `${path}.${key}` : key
    r.skipTrivia()

    // A method shorthand (`plugin() {}`) or getter is not a static value.
    if (r.peek() === '(') {
      r.pos++
      skipBalanced(r, '(', ')', 1)
      r.skipTrivia()
      if (r.peek() === '{') {
        r.pos++
        skipBalanced(r, '{', '}', 1)
      }
      r.unparseable.push(childPath)
      continue
    }

    if (r.peek() !== ':') {
      // Shorthand `{ darkMode }` — the value lives elsewhere.
      r.unparseable.push(childPath)
      continue
    }
    r.pos++

    const v = parseValue(r, childPath, depth + 1)
    if (v === OPAQUE) r.unparseable.push(childPath)
    else out[key] = v
  }
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const MAX_HOPS = 4

/**
 * Walk from an export site to the object literal it ultimately names, through:
 * a wrapper call (`defineConfig({…})`, `withMT({…})`), and a local binding
 * (`const config: Config = {…}; export default config` — the dominant shape of
 * a TypeScript Tailwind config). Returns false when nothing statically
 * reachable is an object literal.
 */
function seekObjectAt(r: Reader, hops: number): boolean {
  if (hops > MAX_HOPS) return false
  r.skipTrivia()
  if (r.peek() === '{') return true
  if (!IDENT_START.test(r.peek())) return false

  const save = r.pos
  const id = readIdentifier(r)
  r.skipTrivia()

  // Any `wrapper(` — we only ever read literals out of it, so peeling an
  // unknown call is safe; a non-object first argument just fails the next hop.
  if (r.peek() === '(') {
    r.pos++
    return seekObjectAt(r, hops + 1)
  }

  // `export default config` → follow the local declaration, skipping any that
  // only appears inside a comment or a string.
  const declRe = new RegExp(
    String.raw`(?:const|let|var)\s+${escapeRe(id)}\s*(?::[^=;]*)?=\s*`,
    'g',
  )
  for (let decl = declRe.exec(r.src); decl !== null; decl = declRe.exec(r.src)) {
    if (r.mask?.[decl.index] === 1) continue
    r.pos = decl.index + decl[0].length
    return seekObjectAt(r, hops + 1)
  }

  r.pos = save
  return false
}

/**
 * Flag every character that sits inside a comment or a string/template literal.
 * Without this, a commented-out `export default { … }` — a genuinely common
 * thing to leave in a config — wins over the real export.
 */
function maskInert(src: string): Uint8Array {
  const mask = new Uint8Array(src.length)
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') mask[i++] = 1
      continue
    }
    if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2)
      const stop = end === -1 ? src.length : end + 2
      while (i < stop) mask[i++] = 1
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      mask[i++] = 1
      while (i < src.length && src[i] !== c) {
        if (src[i] === '\\') mask[i++] = 1
        mask[i++] = 1
      }
      if (i < src.length) mask[i++] = 1
      continue
    }
    i++
  }
  return mask
}

/**
 * Position the reader at the exported config object. Recognises
 * `export default`, `module.exports =`, and `exports.default =`; the earliest
 * one in real code (not in a comment or a string) wins.
 */
function seekExportedObject(r: Reader): boolean {
  const mask = maskInert(r.src)
  r.mask = mask
  const patterns = [/export\s+default\s+/g, /module\.exports\s*=\s*/g, /exports\.default\s*=\s*/g]
  let start = -1
  for (const re of patterns) {
    for (let m = re.exec(r.src); m !== null; m = re.exec(r.src)) {
      if (mask[m.index] === 1) continue
      if (start === -1 || m.index < start) start = m.index + m[0].length
      break
    }
  }
  if (start === -1) return false
  r.pos = start
  return seekObjectAt(r, 0)
}

/**
 * Read the statically evaluable part of a JS/TS config's default export.
 *
 * Never evaluates anything. Properties it cannot resolve are listed in
 * `unparseable` (dotted paths) and omitted from `value`; their siblings are
 * kept. `value` is null only when there is no reachable object literal at all.
 */
export function parseStaticConfigObject(source: string): StaticParseResult {
  if (source.length > MAX_SOURCE) {
    return { value: null, unparseable: [], error: 'config too large to parse statically' }
  }
  const r = new Reader(source)
  try {
    if (!seekExportedObject(r)) {
      return { value: null, unparseable: [], error: 'no statically reachable config object' }
    }
    const value = parseObject(r, '', 0)
    return { value, unparseable: r.unparseable }
  } catch (e) {
    // A syntax or budget failure still surfaces whatever was isolated.
    return { value: null, unparseable: r.unparseable, error: (e as Error).message }
  }
}
