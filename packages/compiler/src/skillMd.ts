// skillMd.ts — compile a DesignSystemSchema to SKILL.md.
//
// SKILL.md is the agent-facing operating manual: how to consume the design
// system when writing code. Base template + framework-specific sections driven
// by `schema.export.frameworks`. Pure, deterministic.

import type { DesignSystemSchema } from './types/schema.js'
import type { ComponentBlueprint } from './types/schema.js'
import { orderBreakpoints, type BreakpointLayer } from './resolveResponsive.js'

/** Mobile-first list of a blueprint's per-breakpoint token overrides, or '' if none. */
function responsiveSnippet(schema: DesignSystemSchema, bp: ComponentBlueprint): string {
  const responsive = bp.responsive as Record<string, BreakpointLayer> | undefined
  const ordered = orderBreakpoints(schema, responsive)
  if (ordered.length === 0) return ''
  const lines = ordered.map(({ name, minWidth, layer }) => {
    const overrides = Object.entries(layer.tokens ?? {})
      .filter(([k, v]) => k !== 'responsive' && v !== undefined)
      .map(([k, v]) => `${k}: ${String(v)}`)
      .join('; ')
    const at = minWidth ? `≥${minWidth} (${name})` : name
    const layout = layer.layout ? ` — ${layer.layout}` : ''
    return `  - ${at}: ${overrides || '—'}${layout}`
  })
  return ['- Responsive (mobile-first; base applies until the breakpoint):', ...lines].join('\n')
}

function frameworkSection(framework: string, schema: DesignSystemSchema): string {
  const prefix = schema.export.tailwindClassPrefix
  const cssPrefix = schema.export.cssVariablePrefix
  switch (framework) {
    case 'react-tailwind':
      return [
        '### React + Tailwind',
        '',
        `- Reference tokens via Tailwind utilities, never inline hex. e.g. \`className="${prefix}text-primary ${prefix}rounded-md"\`.`,
        '- Token names map 1:1 to `tailwind.config.js` theme keys generated from the schema.',
        '- Never write `text-[#...]` arbitrary values — that is drift and will be auto-fixed.',
      ].join('\n')
    case 'react-css':
      return [
        '### React + CSS custom properties',
        '',
        `- Components reference semantic classes styled in their \`.css\` via \`var(--${cssPrefix}color-primary)\`.`,
        '- Variables are emitted to `tokens.css` from the schema; import it once at the app root.',
        '- Never hard-code hex — reference the variable in the component CSS.',
      ].join('\n')
    case 'vue-tailwind':
      return [
        '### Vue + Tailwind',
        '',
        `- Reference tokens via Tailwind utilities in the template, never inline hex. e.g. \`class="${prefix}text-primary ${prefix}rounded-md"\`.`,
        '- Token names map 1:1 to `tailwind.config.js` theme keys generated from the schema.',
        '- Never write `text-[#...]` arbitrary values — that is drift and will be auto-fixed.',
      ].join('\n')
    case 'vue-css':
      return [
        '### Vue + CSS custom properties',
        '',
        `- Reference tokens via CSS variables: \`color: var(--${cssPrefix}color-primary)\`.`,
        '- Variables are emitted to `tokens.css` from the schema; import it once at the app root.',
        '- Never hard-code hex in `<style>` blocks — reference the variable.',
      ].join('\n')
    case 'flutter':
      return [
        '### Flutter',
        '',
        '- Reference tokens via the generated `AppColors` / `AppTheme` classes.',
        '- Never write `Color(0xFF...)` inline — reference the token constant.',
      ].join('\n')
    default:
      return ''
  }
}

function blueprintSection(schema: DesignSystemSchema): string {
  const blocks = Object.values(schema.componentBlueprints).map((bp) => {
    const props = Object.entries(bp.props)
      .map(([name, def]) => {
        const t = def.type === 'enum' ? `enum(${(def.values ?? []).join('|')})` : def.type
        const req = def.required ? ' (required)' : ''
        return `  - \`${name}\`: ${t}${req}${def.description ? ` — ${def.description}` : ''}`
      })
      .join('\n')
    const responsive = responsiveSnippet(schema, bp)
    return [
      `#### ${bp.name}`,
      bp.description,
      `- Anatomy: ${bp.anatomy.join(' › ')}`,
      `- Variants: ${bp.variants.join(', ') || '—'} · Sizes: ${bp.sizes.join(', ') || '—'} · States: ${bp.states.join(', ') || '—'}`,
      props ? `- Props:\n${props}` : '',
      responsive,
    ]
      .filter((l) => l !== '')
      .join('\n')
  })
  return blocks.join('\n\n')
}

/** Compile a schema into a complete SKILL.md document string. */
export function compileSkillMd(schema: DesignSystemSchema): string {
  const frameworks = schema.export.frameworks
  const fwSections = frameworks.map((f) => frameworkSection(f, schema)).filter(Boolean).join('\n\n')

  return [
    `# ${schema.name} — Design System Skill`,
    '',
    'This file tells an AI agent how to build UI that conforms to this design system.',
    'The normative source of truth is `design-spec.schema.json`; `DESIGN.md` carries the human rationale.',
    '',
    '## Golden rule',
    '',
    'Always reference design tokens. Never hard-code raw values (hex, px, `Color(0xFF…)`).',
    'Raw values are *drift* and are auto-rewritten to the nearest token by `design-spec fix` and the CI Drift-Janitor.',
    '',
    '## Getting context efficiently',
    '',
    'Run `design-spec serve` to expose this schema over MCP. Request only the slice you need:',
    '- `get_component_tokens("Button")` — tokens for one component.',
    '- `get_layout_system()` — grid, spacing, container, breakpoints.',
    '- `get_semantic_colors()` — semantic color roles (not the raw palette).',
    '',
    '## Frameworks',
    '',
    fwSections || '_No frameworks configured._',
    '',
    '## Components',
    '',
    blueprintSection(schema),
    '',
  ].join('\n')
}
