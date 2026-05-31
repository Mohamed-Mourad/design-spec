// @design-spec/compiler — the published artifact the web app, CLI, CI
// Drift-Janitor, and the version-pinned closed Figma plugin all depend on.
//
// Every export here is pure and deterministic. types/schema.ts is the single
// source-of-truth contract; see the `evolving-schema-contract` skill before
// changing any shape.

export const COMPILER_VERSION = '0.1.0' as const

// Contract types (single origin)
export * from './types/schema.js'
export type { FileOutput } from './types/compiler.js'

// Defaults
export { defaultSchema, defaultExportConfig } from './defaultSchema.js'

// Authoritative JSON Schema (single source; repo-root design-spec.schema.json is generated from it)
export { designSpecJsonSchema } from './jsonSchema.js'

// Token resolution
export { resolveValue, isTokenRef, refPath, getPath } from './tokenResolver.js'

// Compilers (pure (schema) => string / FileOutput[])
export { compileDesignMd } from './designMd.js'
export { compileSkillMd } from './skillMd.js'
export { compileTailwind } from './tailwind.js'
export { compileVue } from './vue.js'
export { compileReactComponents } from './components/react.js'
export { compileVueComponents } from './components/vue.js'
export { compileAll } from './compile.js'

// Responsive cascade resolution + validation
export {
  resolveResponsive,
  validateResponsiveCascade,
  mergeTokens,
  orderBreakpoints,
} from './resolveResponsive.js'
export type {
  ResolvedResponsive,
  ResolvedBreakpoint,
  BreakpointLayer,
  ResponsiveCascadeIssue,
  ResponsiveIssueKind,
} from './resolveResponsive.js'

// Drift detect + auto-fix
export { detect, nearestColorToken } from './detect.js'
export type { Drift, DriftKind } from './detect.js'
export { fix } from './fix.js'
export type { FixOptions } from './fix.js'

// Best-match heuristic engine (shared by detect; powers fix + the CI Janitor)
export {
  COLOR_DELTA_E_THRESHOLD,
  hexToLab,
  rgbToLab,
  deltaE76,
  parseHex,
} from './colorMatch.js'
export type { Lab, Rgb } from './colorMatch.js'
export { SCALE_GAP_FRACTION, SCALE_SNAP_CAP_PX, nearestScaleToken } from './scaleMatch.js'

// MCP semantic routing resolvers
export {
  get_component_tokens,
  get_layout_system,
  get_semantic_colors,
} from './mcp/route.js'
export type { ComponentTokensSlice, LayoutSystemSlice } from './mcp/route.js'

// Atomic write helper
export { atomicWrite } from './write.js'
