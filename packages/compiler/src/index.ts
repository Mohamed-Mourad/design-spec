// @design-spec/compiler — the published artifact the web app, CLI, CI
// Drift-Janitor, and the version-pinned closed Figma plugin all depend on.
//
// Every export here is pure and deterministic. types/schema.ts is the single
// source-of-truth contract; see the `evolving-schema-contract` skill before
// changing any shape.

export const COMPILER_VERSION = '0.3.0' as const

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
export { compileReactCssComponents } from './components/reactCss.js'
export { compileVueTailwindComponents } from './components/vueTailwind.js'
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

// Token delta — what changed between two design systems. Shared by the web
// staging flow, the closed Figma plugin's approval diff, and mirrored by the Go
// backend's pull-request body.
export { diffTokens, isEmptyDelta, tokenGroupOf, changesByGroup, TOKEN_GROUPS } from './tokenDelta.js'
export type { TokenChange, TokenDelta, TokenGroup } from './tokenDelta.js'

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
export { SCALE_GAP_FRACTION, SCALE_SNAP_CAP_PX, nearestScaleToken, matchScales, nearestInScale, SCALE_ORDER } from './scaleMatch.js'
export type { ScaleMatch, ScaleName } from './scaleMatch.js'
export { nearestColorMatch } from './colorMatch.js'
export type { ColorMatch } from './colorMatch.js'

// Generative bootstrapper snapping — rough vision output -> schema tokens.
// Same ΔE / gap-relative engine as detect+fix, so what a screenshot snaps to
// upstream is byte-identical to what the Janitor rewrites to downstream.
export { snapColor, snapSpatial, snapRef } from './snap.js'
export type { Snap, ColorSnap, SpatialSnap, SnapMiss, SnapColorOptions, SnapSpatialOptions } from './snap.js'

// Git Import / Retrofit extraction — static-only, no code evaluation. Shared by
// the CLI (files off disk) and the web scanner (files harvested over the GitHub
// Contents API), so both paths agree on what a repo's tokens are.
export {
  extractDesignSystem,
  SEMANTIC_INFERENCE_MAX_DELTA_E,
  SCALE_INFERENCE_TOLERANCE,
} from './extract/index.js'
export type { ExtractOptions, ResolvedTokens } from './extract/index.js'
export { detectFramework } from './extract/detectFramework.js'
export { normalizeColor, isColorValue } from './extract/color.js'
export { parseStaticConfigObject } from './extract/staticJs.js'
export type { JsValue, StaticParseResult } from './extract/staticJs.js'
export { extractTailwindConfig, liftTailwindTheme } from './extract/tailwindConfig.js'
export type { TailwindExtraction, TailwindTheme } from './extract/tailwindConfig.js'
export {
  extractCssCustomProps,
  scanCssRules,
  parseDeclarations,
  classifyCssVar,
  tokenKeyFor,
  toDimension,
} from './extract/cssCustomProps.js'
export type { CssVarExtraction, CssVarGroup, CssRule } from './extract/cssCustomProps.js'
export { parseFlutterColors } from './extract/flutterTheme.js'
export type {
  TokenState,
  TokenStateMap,
  ImportFile,
  ImportFileKind,
  ImportInput,
  ImportExtraction,
  ExtractionSignal,
  ExtractionSummary,
  SignalKind,
  FrameworkDetection,
} from './extract/types.js'

// MCP semantic routing resolvers
export {
  get_component_tokens,
  get_layout_system,
  get_semantic_colors,
} from './mcp/route.js'
export type { ComponentTokensSlice, LayoutSystemSlice } from './mcp/route.js'

// Node-only I/O helpers (atomicWrite) live behind the './node' subpath so the
// browser entry stays free of `node:fs`. CLI/janitor import them from
// '@design-spec/compiler/node'.
