// golden.test.ts — byte-stable golden snapshots for every compiler.
//
// Determinism is the asset a buyer underwrites, so the generated artifacts are
// pinned here. A changed snapshot is expected on an output-affecting change —
// review the diff: it IS the new public artifact. Run `vitest -u` to accept.

import { describe, it, expect } from 'vitest'
import { defaultSchema } from './defaultSchema.js'
import { compileDesignMd } from './designMd.js'
import { compileSkillMd } from './skillMd.js'
import { compileTailwind } from './tailwind.js'
import { compileVue } from './vue.js'
import { compileReactComponents } from './components/react.js'
import { compileVueComponents } from './components/vue.js'
import { compileReactCssComponents } from './components/reactCss.js'
import { compileVueTailwindComponents } from './components/vueTailwind.js'
import { compileAll } from './compile.js'
import { responsiveSchema } from './fixtures/responsive.fixture.js'

describe('golden — DESIGN.md', () => {
  it('default schema', () => {
    expect(compileDesignMd(defaultSchema)).toMatchSnapshot()
  })
  it('renders per-component responsive tables', () => {
    const md = compileDesignMd(responsiveSchema)
    expect(md).toContain('**Responsive**')
    // tablet (768px) must appear before desktop (1024px) — mobile-first order.
    expect(md.indexOf('| tablet |')).toBeLessThan(md.indexOf('| desktop |'))
    expect(md).toMatchSnapshot()
  })
})

describe('golden — SKILL.md', () => {
  it('default schema', () => {
    expect(compileSkillMd(defaultSchema)).toMatchSnapshot()
  })
  it('renders per-component responsive snippets', () => {
    const md = compileSkillMd(responsiveSchema)
    expect(md).toContain('- Responsive (mobile-first')
    // tablet (768px) override must list before desktop (1024px) — mobile-first.
    expect(md.indexOf('(tablet)')).toBeLessThan(md.indexOf('(desktop)'))
    expect(md).toMatchSnapshot()
  })
})

describe('golden — Tailwind', () => {
  it('tailwind.config.js + tokens.css', () => {
    expect(compileTailwind(defaultSchema)).toMatchSnapshot()
  })
})

describe('golden — Vue tokens.css', () => {
  it('matches the Tailwind tokens.css byte-for-byte (shared emitter)', () => {
    const tw = compileTailwind(defaultSchema).find((f) => f.filename === 'tokens.css')!
    const vue = compileVue(defaultSchema).find((f) => f.filename === 'tokens.css')!
    expect(vue.content).toBe(tw.content)
  })
  it('default schema', () => {
    expect(compileVue(defaultSchema)).toMatchSnapshot()
  })
})

describe('golden — React components', () => {
  it('default schema', () => {
    expect(compileReactComponents(defaultSchema)).toMatchSnapshot()
  })
  it('emits mobile-first responsive prefixes', () => {
    const button = compileReactComponents(responsiveSchema).find((f) => f.filename === 'components/react-tailwind/Button.tsx')!
    expect(button.content).toContain('tablet:px-lg')
    expect(button.content).toContain('desktop:px-xl')
    expect(button.content.indexOf('tablet:px-lg')).toBeLessThan(button.content.indexOf('desktop:px-xl'))
    expect(button.content).toMatchSnapshot()
  })
})

describe('golden — Vue components', () => {
  it('default schema', () => {
    expect(compileVueComponents(defaultSchema)).toMatchSnapshot()
  })
  it('emits mobile-first @media blocks', () => {
    const button = compileVueComponents(responsiveSchema).find((f) => f.filename === 'components/vue-css/Button.vue')!
    expect(button.content).toContain('@media (min-width: 768px)')
    expect(button.content.indexOf('min-width: 768px')).toBeLessThan(button.content.indexOf('min-width: 1024px'))
    expect(button.content).toMatchSnapshot()
  })
})

describe('golden — compileAll', () => {
  it('default (react-tailwind) file set', () => {
    expect(compileAll(defaultSchema).map((f) => f.filename)).toMatchSnapshot()
  })
  it('vue-css file set', () => {
    const vueSchema = { ...defaultSchema, export: { ...defaultSchema.export, frameworks: ['vue-css' as const] } }
    expect(compileAll(vueSchema).map((f) => f.filename)).toMatchSnapshot()
  })
  it('multi-stack: every stack namespaces its components, shared files dedup', () => {
    const all = {
      ...defaultSchema,
      export: {
        ...defaultSchema.export,
        frameworks: ['react-tailwind', 'react-css', 'vue-tailwind', 'vue-css'] as const,
      },
    }
    const names = compileAll(all).map((f) => f.filename)
    // No filename collisions across stacks.
    expect(new Set(names).size).toBe(names.length)
    // Shared artifacts appear exactly once.
    expect(names.filter((n) => n === 'tokens.css')).toHaveLength(1)
    expect(names.filter((n) => n === 'tailwind.config.js')).toHaveLength(1)
    // Each stack contributes its own namespaced Button.
    expect(names).toContain('components/react-tailwind/Button.tsx')
    expect(names).toContain('components/react-css/Button.tsx')
    expect(names).toContain('components/react-css/Button.css')
    expect(names).toContain('components/vue-tailwind/Button.vue')
    expect(names).toContain('components/vue-css/Button.vue')
    expect(names).toMatchSnapshot()
  })
})

describe('golden — React+CSS components', () => {
  it('default schema (.tsx + .css)', () => {
    expect(compileReactCssComponents(defaultSchema)).toMatchSnapshot()
  })
  it('css resolves to var(--token) and tsx references the semantic class', () => {
    const css = compileReactCssComponents(defaultSchema).find((f) => f.filename === 'components/react-css/Button.css')!
    const tsx = compileReactCssComponents(defaultSchema).find((f) => f.filename === 'components/react-css/Button.tsx')!
    expect(css.content).toContain('var(--color-primary)')
    expect(css.content).not.toMatch(/#[0-9a-fA-F]{6}/) // no raw hex
    expect(tsx.content).toContain("import './Button.css'")
    expect(tsx.content).toContain("'button'")
  })
})

describe('golden — Vue+Tailwind components', () => {
  it('default schema', () => {
    expect(compileVueTailwindComponents(defaultSchema)).toMatchSnapshot()
  })
  it('uses utility classes, no scoped style', () => {
    const button = compileVueTailwindComponents(defaultSchema).find((f) => f.filename === 'components/vue-tailwind/Button.vue')!
    expect(button.content).toContain('bg-primary')
    expect(button.content).not.toContain('<style')
  })
})

describe('determinism', () => {
  it('every compiler is a pure function of the schema', () => {
    expect(compileDesignMd(defaultSchema)).toBe(compileDesignMd(defaultSchema))
    expect(compileSkillMd(defaultSchema)).toBe(compileSkillMd(defaultSchema))
    expect(JSON.stringify(compileAll(defaultSchema))).toBe(JSON.stringify(compileAll(defaultSchema)))
  })
})
