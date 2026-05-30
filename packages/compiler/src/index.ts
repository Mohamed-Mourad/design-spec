// @design-spec/compiler — the published artifact the web app, CLI, CI
// Drift-Janitor, and the version-pinned closed Figma plugin all depend on.
//
// Every export here is pure and deterministic. types/schema.ts is the single
// source-of-truth contract; see the `evolving-schema-contract` skill before
// changing any shape.

export const COMPILER_VERSION = '0.0.1' as const

// Contract types (single origin)
export * from './types/schema'
export type { FileOutput } from './types/compiler'

// Defaults
export { defaultSchema, defaultExportConfig } from './defaultSchema'

// Token resolution
export { resolveValue, isTokenRef, refPath, getPath } from './tokenResolver'

// Compilers (pure (schema) => string / FileOutput[])
export { compileDesignMd } from './designMd'
export { compileSkillMd } from './skillMd'
export { compileTailwind } from './tailwind'
export { compileVue } from './vue'
export { compileAll } from './compile'

// Drift detect + auto-fix
export { detect, nearestColorToken } from './detect'
export type { Drift, DriftKind } from './detect'
export { fix } from './fix'
export type { FixOptions } from './fix'

// MCP semantic routing resolvers
export {
  get_component_tokens,
  get_layout_system,
  get_semantic_colors,
} from './mcp/route'
export type { ComponentTokensSlice, LayoutSystemSlice } from './mcp/route'

// Atomic write helper
export { atomicWrite } from './write'
