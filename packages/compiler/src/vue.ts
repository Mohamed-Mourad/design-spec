// vue.ts — compile a schema to tokens.css custom properties for a Vue app.
//
// Pure (schema) => FileOutput[], deterministic. Vue projects consume tokens as
// plain CSS custom properties (no Tailwind theme object). The variable set is the
// shared emitter (`cssVars.ts`) so it never drifts from the Tailwind tokens.css.

import type { DesignSystemSchema } from './types/schema.js'
import type { FileOutput } from './types/compiler.js'
import { tokensCss } from './cssVars.js'

export function compileVue(schema: DesignSystemSchema): FileOutput[] {
  return [{ filename: 'tokens.css', content: tokensCss(schema), language: 'css' }]
}
