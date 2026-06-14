// edge.test.ts — exercises the optional/rare branches the default schema doesn't
// hit: every framework section, optional typography props, array-valued shadows,
// hidden/annotated responsive layers, and unknown-breakpoint handling.

import { describe, it, expect } from 'vitest'
import type { DesignSystemSchema, BreakpointLayer } from './index.js'
import { defaultSchema } from './defaultSchema.js'
import { compileSkillMd } from './skillMd.js'
import { compileDesignMd } from './designMd.js'
import { compileVueComponents } from './components/vue.js'
import { orderBreakpoints, resolveResponsive, validateResponsiveCascade } from './resolveResponsive.js'

describe('skillMd — all framework sections', () => {
  it('renders react, vue, and flutter sections', () => {
    const schema: DesignSystemSchema = {
      ...defaultSchema,
      export: { ...defaultSchema.export, frameworks: ['react-tailwind', 'vue-css', 'flutter'] },
    }
    const md = compileSkillMd(schema)
    expect(md).toContain('### React + Tailwind')
    expect(md).toContain('### Vue + CSS custom properties')
    expect(md).toContain('### Flutter')
  })

  it('handles a schema with no frameworks', () => {
    const schema: DesignSystemSchema = {
      ...defaultSchema,
      export: { ...defaultSchema.export, frameworks: [] },
    }
    expect(compileSkillMd(schema)).toContain('_No frameworks configured._')
  })
})

describe('designMd — optional token branches', () => {
  const schema: DesignSystemSchema = {
    ...defaultSchema,
    overview: { ...defaultSchema.overview, moodKeywords: [] },
    typography: {
      'display-x': {
        fontFamily: 'Space Grotesk',
        fontSize: '64px',
        fontWeight: 700,
        lineHeight: 1.05,
        letterSpacing: '-0.03em',
        fontFeature: '"ss01"',
        fontVariation: '"wght" 700',
        textTransform: 'uppercase',
      },
    },
    shadows: {
      layered: { value: ['0 1px 2px rgba(0,0,0,0.1)', '0 8px 16px rgba(0,0,0,0.1)'], inset: false },
    },
    prose: {},
  }

  it('compiles without prose, with array shadows and full typography', () => {
    const md = compileDesignMd(schema)
    expect(md).toContain('display-x')
    expect(md).toContain('0 1px 2px rgba(0,0,0,0.1), 0 8px 16px rgba(0,0,0,0.1)')
    expect(md.startsWith('---\n')).toBe(true)
  })
})

describe('responsive — visibility, notes, unknown breakpoints', () => {
  const responsive: Record<string, BreakpointLayer> = {
    mystery: { tokens: { paddingX: '{spacing.lg}' }, notes: 'custom bp' }, // not in schema.breakpoints
    tablet: { visibleAt: false, layout: 'hidden on tablet' },
  }
  const base = defaultSchema.componentBlueprints.Button.tokens.base

  it('orders unknown breakpoints last (null min-width)', () => {
    const ordered = orderBreakpoints(defaultSchema, responsive)
    expect(ordered[ordered.length - 1].name).toBe('mystery')
    expect(ordered[ordered.length - 1].minWidth).toBeNull()
  })

  it('resolveResponsive carries visibleAt + notes', () => {
    const resolved = resolveResponsive(defaultSchema, base, responsive)
    const tablet = resolved.breakpoints.find((b) => b.name === 'tablet')!
    expect(tablet.visibleAt).toBe(false)
    const mystery = resolved.breakpoints.find((b) => b.name === 'mystery')!
    expect(mystery.notes).toBe('custom bp')
  })

  it('designMd shows hidden visibility and em-dash for unknown min-width', () => {
    const schema: DesignSystemSchema = {
      ...defaultSchema,
      componentBlueprints: {
        Button: { ...defaultSchema.componentBlueprints.Button, responsive },
      },
    }
    const md = compileDesignMd(schema)
    expect(md).toContain('| tablet | 768px | hidden |')
    expect(md).toContain('| mystery | — |')
  })

  it('validateResponsiveCascade flags the unknown breakpoint', () => {
    const issues = validateResponsiveCascade(defaultSchema, base, responsive)
    expect(issues.some((i) => i.kind === 'unknown-breakpoint' && i.breakpoint === 'mystery')).toBe(true)
  })

  it('vue components skip @media for an unknown (null min-width) breakpoint', () => {
    const schema: DesignSystemSchema = {
      ...defaultSchema,
      componentBlueprints: {
        Button: { ...defaultSchema.componentBlueprints.Button, responsive: { mystery: { tokens: { paddingX: '{spacing.lg}' } } } },
      },
    }
    const vue = compileVueComponents(schema).find((f) => f.filename === 'components/vue-css/Button.vue')!
    expect(vue.content).not.toContain('@media')
  })
})
