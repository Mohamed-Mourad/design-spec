// fixAlignment.test.ts — the Janitor's Flutter rewrite must name identifiers
// the generated lib/theme/app_colors.dart actually declares, in every naming
// mode; otherwise a "fixed" file stops compiling.

import { describe, it, expect } from 'vitest'
import { FLUTTER_NAMINGS, flutterSchema, withNaming } from '../fixtures/flutter.fixture.js'
import { detect } from '../detect.js'
import { fix } from '../fix.js'
import { compileFlutterColors } from './colors.js'

/** Identifiers declared by app_colors.dart, as referenced from outside. */
function declared(content: string): Set<string> {
  const out = new Set<string>()
  let cls: string | null = null
  for (const line of content.split('\n')) {
    const c = line.match(/^abstract final class (\w+)/)
    if (c) cls = c[1]
    if (line === '}') cls = null
    const m = line.match(/const Color (\w+) =/)
    if (m) out.add(cls ? `${cls}.${m[1]}` : m[1])
  }
  return out
}

describe('fix ↔ Flutter compiler alignment', () => {
  it.each(FLUTTER_NAMINGS)('%s: every color fix targets a declared identifier', (naming) => {
    const schema = withNaming(naming, {
      ...flutterSchema,
      colors: { ...flutterSchema.colors, '2xl-accent': '#7C3AED', default: '#111827', onBrand: '#FDE68A' },
    })
    const names = declared(compileFlutterColors(schema).content)
    for (const hex of Object.values(schema.colors)) {
      const src = `Color(0xFF${hex.slice(1)})`
      const out = fix(src, detect(src, schema, 'x.dart'), schema, { target: 'flutter' })
      expect(names, `${src} → ${out}`).toContain(out)
    }
  })
})
