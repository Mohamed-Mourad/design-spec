// compile.ts — aggregate every output the schema's configured frameworks need.
//
// Pure (schema) => FileOutput[]. DESIGN.md and SKILL.md are always emitted
// (framework-independent). Framework-specific outputs are added per
// `schema.export.frameworks`. Deterministic ordering.

import type { DesignSystemSchema } from './types/schema.js'
import type { FileOutput } from './types/compiler.js'
import { compileDesignMd } from './designMd.js'
import { compileSkillMd } from './skillMd.js'
import { compileTailwind } from './tailwind.js'
import { compileVue } from './vue.js'
import { compileReactComponents } from './components/react.js'
import { compileVueComponents } from './components/vue.js'

/** Compile all outputs for a schema, deduplicated by filename (first wins). */
export function compileAll(schema: DesignSystemSchema): FileOutput[] {
  const outputs: FileOutput[] = [
    { filename: 'DESIGN.md', content: compileDesignMd(schema), language: 'markdown' },
    { filename: 'SKILL.md', content: compileSkillMd(schema), language: 'markdown' },
  ]

  for (const framework of schema.export.frameworks) {
    if (framework === 'react-tailwind') outputs.push(...compileTailwind(schema), ...compileReactComponents(schema))
    else if (framework === 'vue-css') outputs.push(...compileVue(schema), ...compileVueComponents(schema))
    // flutter: Phase 10
  }

  // Dedup by filename (e.g. tailwind + vue both emit tokens.css) — first wins.
  const seen = new Set<string>()
  return outputs.filter((o) => (seen.has(o.filename) ? false : (seen.add(o.filename), true)))
}
