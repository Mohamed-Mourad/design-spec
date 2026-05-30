// designMd.ts — compile a DesignSystemSchema to a spec.md-compliant DESIGN.md.
//
// Pure (schema) => string, deterministic. YAML frontmatter (machine-readable
// tokens) + markdown body (human-readable rationale) in the spec's section
// order. Phase 1 working-minimal; Phase 2 hardens with golden snapshots.

import type { DesignSystemSchema, TypographyToken } from './types/schema.js'
import { toYaml, type YamlMap } from './yaml.js'

function frontmatter(schema: DesignSystemSchema): string {
  const fm: YamlMap = {
    version: schema.version,
    name: schema.name,
    description: schema.description,
    colors: schema.colors as YamlMap,
    typography: Object.fromEntries(
      Object.entries(schema.typography).map(([k, t]) => [k, typographyMap(t)]),
    ) as YamlMap,
    spacing: schema.spacing as YamlMap,
    rounded: schema.rounded as YamlMap,
    components: schema.components as unknown as YamlMap,
  }
  return `---\n${toYaml(fm)}\n---`
}

function typographyMap(t: TypographyToken): YamlMap {
  const m: YamlMap = {
    fontFamily: t.fontFamily,
    fontSize: t.fontSize,
    fontWeight: t.fontWeight,
    lineHeight: t.lineHeight,
  }
  if (t.letterSpacing !== undefined) m.letterSpacing = t.letterSpacing
  if (t.fontFeature !== undefined) m.fontFeature = t.fontFeature
  if (t.fontVariation !== undefined) m.fontVariation = t.fontVariation
  if (t.textTransform !== undefined) m.textTransform = t.textTransform
  return m
}

function section(title: string, body: string): string {
  return `## ${title}\n\n${body.trim()}\n`
}

function colorsBody(schema: DesignSystemSchema): string {
  const lines = Object.entries(schema.colors).map(
    ([name, hex]) => `- **${titleCase(name)} (${hex}):** ${name} color token.`,
  )
  return [schema.prose.colors ?? '', '', ...lines].join('\n')
}

function typographyBody(schema: DesignSystemSchema): string {
  const lines = Object.entries(schema.typography).map(
    ([name, t]) => `- **${titleCase(name)}:** ${t.fontFamily} ${t.fontSize}/${String(t.lineHeight)}, weight ${t.fontWeight}.`,
  )
  return [schema.prose.typography ?? '', '', ...lines].join('\n')
}

function layoutBody(schema: DesignSystemSchema): string {
  const rows = Object.entries(schema.spacing)
    .map(([k, v]) => `| ${k} | ${String(v)} |`)
    .join('\n')
  return [
    schema.prose.layout ?? '',
    '',
    `A ${schema.layout.grid.columns}-column grid; content caps at ${schema.layout.container.maxWidth}.`,
    '',
    '| Step | Value |',
    '|---|---|',
    rows,
  ].join('\n')
}

function elevationBody(schema: DesignSystemSchema): string {
  const rows = Object.entries(schema.shadows)
    .map(([k, s]) => `| ${k} | \`${Array.isArray(s.value) ? s.value.join(', ') : s.value}\` |`)
    .join('\n')
  return [schema.prose.elevation ?? '', '', '| Level | box-shadow |', '|---|---|', rows].join('\n')
}

function shapesBody(schema: DesignSystemSchema): string {
  const rows = Object.entries(schema.rounded)
    .map(([k, v]) => `| ${k} | ${String(v)} |`)
    .join('\n')
  return [schema.prose.shapes ?? '', '', '| Level | Radius |', '|---|---|', rows].join('\n')
}

function componentsBody(schema: DesignSystemSchema): string {
  const blocks = Object.values(schema.componentBlueprints).map((bp) => {
    const dos = bp.dosDonts?.dos.map((d) => `- ${d}`).join('\n') ?? ''
    const donts = bp.dosDonts?.donts.map((d) => `- ${d}`).join('\n') ?? ''
    return [
      `### ${bp.name}`,
      bp.description,
      '',
      `**Variants:** ${bp.variants.join(', ') || '—'}  `,
      `**Sizes:** ${bp.sizes.join(', ') || '—'}  `,
      `**States:** ${bp.states.join(', ') || '—'}`,
      dos || donts ? '' : '',
      dos ? `**Do**\n${dos}` : '',
      donts ? `**Don't**\n${donts}` : '',
    ]
      .filter((l) => l !== '')
      .join('\n')
  })
  return blocks.join('\n\n')
}

function dosDontsBody(schema: DesignSystemSchema): string {
  const items = schema.prose.dosDonts ?? []
  return items.map((d) => `- ${d}`).join('\n')
}

function titleCase(s: string): string {
  return s.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Compile a schema into a complete DESIGN.md document string. */
export function compileDesignMd(schema: DesignSystemSchema): string {
  const ov = schema.overview
  const overviewBody = [
    schema.prose.overview ?? '',
    '',
    `**Personality:** ${ov.brandPersonality}`,
    `**Audience:** ${ov.targetAudience}`,
    `**Direction:** ${ov.aestheticDirection}`,
    ov.moodKeywords.length ? `**Mood:** ${ov.moodKeywords.join(', ')}` : '',
  ]
    .filter((l) => l !== '')
    .join('\n')

  const parts = [
    frontmatter(schema),
    '',
    `# ${schema.name}`,
    '',
    section('Overview', overviewBody),
    section('Colors', colorsBody(schema)),
    section('Typography', typographyBody(schema)),
    section('Layout', layoutBody(schema)),
    section('Elevation & Depth', elevationBody(schema)),
    section('Shapes', shapesBody(schema)),
    section('Components', componentsBody(schema)),
    section("Do's and Don'ts", dosDontsBody(schema)),
  ]
  return parts.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n'
}
