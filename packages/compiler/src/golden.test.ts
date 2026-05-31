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
    const button = compileReactComponents(responsiveSchema).find((f) => f.filename === 'components/Button.tsx')!
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
    const button = compileVueComponents(responsiveSchema).find((f) => f.filename === 'components/Button.vue')!
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
})

describe('determinism', () => {
  it('every compiler is a pure function of the schema', () => {
    expect(compileDesignMd(defaultSchema)).toBe(compileDesignMd(defaultSchema))
    expect(compileSkillMd(defaultSchema)).toBe(compileSkillMd(defaultSchema))
    expect(JSON.stringify(compileAll(defaultSchema))).toBe(JSON.stringify(compileAll(defaultSchema)))
  })
})
