// yaml.ts — a tiny deterministic YAML emitter for DESIGN.md frontmatter.
//
// We emit our own YAML rather than pulling in js-yaml so the output is fully
// under our control and byte-stable (the compilers are the M&A asset; a buyer
// underwrites determinism). Handles the value shapes our schema produces:
// strings, numbers, booleans, nested maps, and arrays of scalars. Insertion
// order is preserved — callers control ordering.

type Yamlable = string | number | boolean | null | YamlMap | Yamlable[]
interface YamlMap {
  [key: string]: Yamlable | undefined
}

/** A string needs quoting if it could be misread as another YAML type. */
function needsQuote(s: string): boolean {
  if (s === '') return true
  if (/^[#{}\[\]&*!|>'"%@`]/.test(s)) return true // leading indicator chars (incl. # hex, { ref)
  if (/[:#]\s/.test(s) || /:\s*$/.test(s)) return true
  if (/^\s|\s$/.test(s)) return true
  if (/^(true|false|null|yes|no|on|off|~)$/i.test(s)) return true
  if (/^[+-]?(\d|\.\d)/.test(s) && /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s)) return true
  return false
}

function scalar(value: string | number | boolean | null): string {
  if (value === null) return 'null'
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return needsQuote(value) ? `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : value
}

function isMap(v: Yamlable): v is YamlMap {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function emit(value: Yamlable, indent: number): string[] {
  const pad = '  '.repeat(indent)
  if (Array.isArray(value)) {
    if (value.length === 0) return [`${pad}[]`]
    return value.flatMap((item) => {
      if (isMap(item) || Array.isArray(item)) {
        const lines = emit(item, indent + 1)
        // splice the dash onto the first child line
        const first = lines[0].replace(/^ {2}/, '')
        return [`${pad}- ${first.trimStart()}`, ...lines.slice(1)]
      }
      return [`${pad}- ${scalar(item as string | number | boolean | null)}`]
    })
  }
  if (isMap(value)) {
    const lines: string[] = []
    for (const [key, v] of Object.entries(value)) {
      if (v === undefined) continue
      if (isMap(v) && Object.keys(v).length > 0) {
        lines.push(`${pad}${key}:`)
        lines.push(...emit(v, indent + 1))
      } else if (Array.isArray(v) && v.length > 0) {
        lines.push(`${pad}${key}:`)
        lines.push(...emit(v, indent + 1))
      } else if (isMap(v) || Array.isArray(v)) {
        lines.push(`${pad}${key}: ${Array.isArray(v) ? '[]' : '{}'}`)
      } else {
        lines.push(`${pad}${key}: ${scalar(v as string | number | boolean | null)}`)
      }
    }
    return lines
  }
  return [`${pad}${scalar(value as string | number | boolean | null)}`]
}

/** Serialize a map to YAML (no document markers). */
export function toYaml(map: YamlMap): string {
  return emit(map, 0).join('\n')
}

export type { YamlMap, Yamlable }
