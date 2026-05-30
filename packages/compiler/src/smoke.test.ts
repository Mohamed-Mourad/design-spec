// Phase 1 smoke coverage for the compiler engine. The full golden/snapshot +
// property suite is a Phase 2 deliverable (see phase2-plan.md); these tests
// just prove the functions the CLI depends on behave before it leans on them.

import { describe, it, expect } from 'vitest'
import { defaultSchema } from './defaultSchema.js'
import { compileDesignMd } from './designMd.js'
import { compileSkillMd } from './skillMd.js'
import { compileAll } from './compile.js'
import { detect } from './detect.js'
import { fix } from './fix.js'
import { get_component_tokens, get_layout_system, get_semantic_colors } from './mcp/route.js'

describe('compileDesignMd', () => {
  it('emits spec.md frontmatter + the section order', () => {
    const md = compileDesignMd(defaultSchema)
    expect(md.startsWith('---\n')).toBe(true)
    for (const h of ['## Overview', '## Colors', '## Typography', '## Layout', '## Elevation & Depth', '## Shapes', '## Components', "## Do's and Don'ts"]) {
      expect(md).toContain(h)
    }
  })

  it('is deterministic', () => {
    expect(compileDesignMd(defaultSchema)).toBe(compileDesignMd(defaultSchema))
  })
})

describe('compileSkillMd', () => {
  it('documents components and the golden rule', () => {
    const s = compileSkillMd(defaultSchema)
    expect(s).toContain('Golden rule')
    expect(s).toContain('#### Button')
  })
})

describe('compileAll', () => {
  it('always emits DESIGN.md + SKILL.md and react-tailwind outputs by default', () => {
    const files = compileAll(defaultSchema).map((f) => f.filename)
    expect(files).toContain('DESIGN.md')
    expect(files).toContain('SKILL.md')
    expect(files).toContain('tailwind.config.js')
    expect(files).toContain('tokens.css')
  })
})

describe('detect + fix', () => {
  it('finds inline hex and resolves it to the nearest color token', () => {
    const drifts = detect('const c = "#2563EB"', defaultSchema, 'a.ts')
    expect(drifts).toHaveLength(1)
    expect(drifts[0].kind).toBe('inline-hex')
    expect(drifts[0].nearestToken).toBe('colors.primary')
    expect(drifts[0].fixable).toBe(true)
  })

  it('rewrites an arbitrary Tailwind class to a token class', () => {
    const src = '<div className="text-[#2563EB]" />'
    const patched = fix(src, detect(src, defaultSchema, 'a.tsx'), defaultSchema)
    expect(patched).toBe('<div className="text-primary" />')
  })

  it('is idempotent — fix(fix(x)) === fix(x)', () => {
    const src = 'a: #2563EB; b: text-[#475569];'
    const once = fix(src, detect(src, defaultSchema, 'a.css'), defaultSchema)
    const twice = fix(once, detect(once, defaultSchema, 'a.css'), defaultSchema)
    expect(twice).toBe(once)
  })

  it('leaves unmapped values untouched', () => {
    const src = 'color: #ABCDEF' // far from any token
    const patched = fix(src, detect(src, defaultSchema, 'a.css'), defaultSchema)
    expect(patched).toBe(src)
  })
})

describe('mcp resolvers', () => {
  it('get_component_tokens returns only the requested component', () => {
    const slice = get_component_tokens(defaultSchema, 'Button')
    expect(slice?.component).toBe('Button')
    expect(JSON.stringify(slice)).not.toContain('Input')
  })

  it('get_component_tokens resolves token refs to concrete values', () => {
    const slice = get_component_tokens(defaultSchema, 'Button')!
    expect(slice.tokens.base.backgroundColor).toBe('#2563EB')
  })

  it('get_component_tokens returns null for an unknown component', () => {
    expect(get_component_tokens(defaultSchema, 'Nope')).toBeNull()
  })

  it('get_layout_system exposes grid + spacing, not components', () => {
    const layout = get_layout_system(defaultSchema)
    expect(layout.grid.columns).toBe(12)
    expect(JSON.stringify(layout)).not.toContain('Button')
  })

  it('get_semantic_colors returns roles', () => {
    expect(get_semantic_colors(defaultSchema).primary).toBe('#2563EB')
  })
})
