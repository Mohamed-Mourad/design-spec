// types/schema.ts — the single source-of-truth contract.
//
// DesignSystemSchema is the asset every Design Spec repo depends on (compiler,
// CLI, janitor, web, admin, Go backend, the version-pinned Figma plugin). This
// file is the ONE origin; every other shape (design-spec.schema.json, Go
// structs) is derived from it and must follow it. See the
// `evolving-schema-contract` skill before changing anything here.

// ── Primitive token value types ──────────────────────────────────────────────

/** Hex color in the sRGB space, e.g. `#1A1C1E`. Hex only, per spec.md. */
export type ColorValue = `#${string}`

/** A dimension: number + unit (`12px`, `1.5rem`, `0.1em`) or a unitless number. */
export type DimensionValue = `${number}${'px' | 'rem' | 'em'}` | number

/** A `{path.to.token}` reference into the schema tree, resolved at compile time. */
export type TokenRef = `{${string}}`

/** A raw CSS `box-shadow` string. */
export type ShadowValue = string

// ── Token group element types ────────────────────────────────────────────────

export interface TypographyToken {
  fontFamily: string
  fontSize: DimensionValue
  fontWeight: number
  lineHeight: DimensionValue | number
  letterSpacing?: DimensionValue
  fontFeature?: string
  fontVariation?: string
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize'
}

export interface ShadowToken {
  /** Single layer or an array of layers composited into one `box-shadow`. */
  value: ShadowValue | ShadowValue[]
  inset?: boolean
}

/** Style tokens for one component (or component variant). Feeds DESIGN.md. */
export interface ComponentTokenGroup {
  backgroundColor?: ColorValue | TokenRef
  textColor?: ColorValue | TokenRef
  typography?: TokenRef
  rounded?: DimensionValue | TokenRef
  padding?: DimensionValue | TokenRef
  paddingX?: DimensionValue | TokenRef
  paddingY?: DimensionValue | TokenRef
  borderColor?: ColorValue | TokenRef
  borderWidth?: DimensionValue | TokenRef
  shadow?: ShadowValue | TokenRef
  size?: DimensionValue
  height?: DimensionValue
  width?: DimensionValue
  // Unknown props are accepted with a warning, per spec.md.
  [key: string]: unknown
  /** Breakpoint overrides keyed by a breakpoint name from `schema.breakpoints`. */
  responsive?: {
    [breakpoint: string]: Omit<ComponentTokenGroup, 'responsive'>
  }
}

export interface ResponsiveBreakpoint {
  tokens?: Omit<ComponentTokenGroup, 'responsive'>
  /** Prose: "collapses to hamburger", "stacks vertically". */
  layout?: string
  /** false = component hidden at this breakpoint. */
  visibleAt?: boolean
  notes?: string
}

// ── Component blueprints — drive code generation (SKILL.md + stubs) ───────────

export interface PropDefinition {
  type: 'string' | 'boolean' | 'number' | 'enum' | 'slot'
  /** Allowed values for `enum`. */
  values?: string[]
  default?: unknown
  required?: boolean
  description?: string
}

export interface ComponentExample {
  label: string
  props: Record<string, unknown>
  /** Optional per-framework code overrides. */
  code?: {
    react?: string
    vue?: string
    flutter?: string
  }
}

export interface ComponentBlueprint {
  name: string
  description: string
  category: 'action' | 'form' | 'feedback' | 'navigation' | 'layout' | 'data'
  variants: string[]
  sizes: string[]
  states: string[]
  /** Structural slots, e.g. ["root", "label", "icon", "spinner"]. */
  anatomy: string[]
  props: Record<string, PropDefinition>
  tokens: {
    base: ComponentTokenGroup
    [variant: string]: ComponentTokenGroup
  }
  examples: ComponentExample[]
  dosDonts?: {
    dos: string[]
    donts: string[]
  }
  responsive?: Record<string, ResponsiveBreakpoint>
}

// ── Settings layers ──────────────────────────────────────────────────────────

/** Layer 1 — CLI-configured, git-tracked, governs all code-generation output. */
export interface ExportConfig {
  frameworks: Array<'react-tailwind' | 'vue-css' | 'flutter'>
  webNamingConvention: 'kebab-case' | 'camelCase' | 'snake_case' | 'SCREAMING_SNAKE'
  /** Default "" — emits `--color-primary`. */
  cssVariablePrefix: string
  /** Default "" — emits `text-primary`. */
  tailwindClassPrefix: string
  flutterNaming: 'prefixed-class' | 'snake_const' | 'raw'
  fontLoading: 'auto' | 'manual'
  fontSource: 'google' | 'bunny' | 'custom'
  fontSourceUrl?: string
}

/** Layer 3 — backend-managed presentation config, synced via `design-spec sync`. */
export interface WebPresentationConfig {
  bentoLayout?: BentoLayoutConfig
  proposalBranding?: {
    logoUrl?: string
    companyName?: string
    accentColor?: ColorValue
    hideDesignSpecBranding?: boolean
  }
  publicSlug?: string
  whiteLabelDomain?: string
  embedOptions?: {
    allowIframe: boolean
    allowedOrigins?: string[]
    showTokenValues: boolean
  }
  ogImageStrategy: 'server-render' | 'client-canvas'
}

export interface BentoLayoutConfig {
  cells: BentoCellConfig[]
  gridColumns: 2 | 3 | 4
  theme: 'light' | 'dark' | 'system'
  showTitle: boolean
  showDescription: boolean
}

export interface BentoCellConfig {
  id:
    | 'identity'
    | 'colors'
    | 'typography'
    | 'spacing'
    | 'shadows'
    | 'radius'
    | 'buttons'
    | 'inputs'
    | 'cards'
    | 'badges'
    | 'motion'
  visible: boolean
  span?: 1 | 2
  customLabel?: string
}

// ── The top-level schema ─────────────────────────────────────────────────────

export interface DesignSystemSchema {
  // Meta
  version: string
  name: string
  description?: string

  // Identity / brand
  overview: {
    brandPersonality: string
    targetAudience: string
    aestheticDirection: string
    moodKeywords: string[]
  }

  // Token groups (all feed DESIGN.md frontmatter)
  colors: Record<string, ColorValue>
  typography: Record<string, TypographyToken>
  spacing: Record<string, DimensionValue | number>
  rounded: Record<string, DimensionValue>
  shadows: Record<string, ShadowToken>
  borders: {
    width: Record<string, DimensionValue>
    color: Record<string, ColorValue | TokenRef>
  }
  transitions: {
    duration: Record<string, string>
    easing: Record<string, string>
    reducedMotion: boolean
  }
  breakpoints: Record<string, DimensionValue>
  zIndex: Record<string, number>
  opacity: Record<string, number>
  icons: {
    library: string
    size: Record<string, DimensionValue>
  }
  layout: {
    grid: { columns: number; gutter: DimensionValue | TokenRef; margin: DimensionValue | TokenRef }
    container: { maxWidth: DimensionValue; paddingX: DimensionValue | TokenRef }
  }

  // Component style tokens (DESIGN.md frontmatter)
  components: Record<string, ComponentTokenGroup>

  // Component blueprints (SKILL.md + code generation)
  componentBlueprints: Record<string, ComponentBlueprint>

  // Prose sections (DESIGN.md markdown body)
  prose: {
    overview?: string
    colors?: string
    typography?: string
    layout?: string
    elevation?: string
    shapes?: string
    dosDonts?: string[]
  }

  // Dark mode overrides (color overrides only)
  darkMode: { enabled: boolean; colors: Record<string, ColorValue> }

  // Layer 1 — CLI-configured, git-tracked export config
  export: ExportConfig

  // Layer 3 — backend-synced presentation config (optional locally)
  presentation?: WebPresentationConfig
}
