// The slice of the Figma REST API this app reads.
//
// Hand-written rather than generated: the browser calls three endpoints and
// touches a handful of fields on each, and a generated client for the whole API
// would be far more surface than the import needs. Every field here is optional
// where Figma may omit it — a file is user content, and a missing `fills` array
// must read as "nothing to map", never as a crash.

/** `GET /v1/files/{key}/styles` — style metadata. Values live on the nodes. */
export interface FigmaStyleMeta {
  key: string
  node_id: string
  style_type: 'FILL' | 'TEXT' | 'EFFECT' | 'GRID'
  name: string
  description?: string
}

export interface FigmaStylesResponse {
  meta?: { styles?: FigmaStyleMeta[] }
}

/** Figma colors are 0–1 floats, not 0–255 bytes. */
export interface FigmaColor {
  r: number
  g: number
  b: number
  a?: number
}

export interface FigmaPaint {
  type: string
  visible?: boolean
  opacity?: number
  color?: FigmaColor
}

export interface FigmaEffect {
  type: 'DROP_SHADOW' | 'INNER_SHADOW' | 'LAYER_BLUR' | 'BACKGROUND_BLUR' | string
  visible?: boolean
  color?: FigmaColor
  offset?: { x: number; y: number }
  radius?: number
  spread?: number
}

export interface FigmaTypeStyle {
  fontFamily?: string
  fontWeight?: number
  fontSize?: number
  letterSpacing?: number
  lineHeightPx?: number
  lineHeightPercentFontSize?: number
  lineHeightUnit?: string
  textCase?: 'ORIGINAL' | 'UPPER' | 'LOWER' | 'TITLE' | string
}

export interface FigmaNode {
  id: string
  name?: string
  fills?: FigmaPaint[]
  effects?: FigmaEffect[]
  style?: FigmaTypeStyle
}

/** `GET /v1/files/{key}/nodes?ids=…` — the values behind the style metadata. */
export interface FigmaNodesResponse {
  nodes?: Record<string, { document?: FigmaNode } | null>
}

export type FigmaVariableValue =
  | FigmaColor
  | number
  | string
  | boolean
  | { type: 'VARIABLE_ALIAS'; id: string }

export interface FigmaVariable {
  id: string
  name: string
  variableCollectionId: string
  resolvedType: 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN' | string
  valuesByMode: Record<string, FigmaVariableValue>
}

export interface FigmaVariableCollection {
  id: string
  name: string
  defaultModeId: string
  modes: { modeId: string; name: string }[]
}

/** `GET /v1/files/{key}/variables/local` — Figma Professional and above. */
export interface FigmaVariablesResponse {
  meta?: {
    variables?: Record<string, FigmaVariable>
    variableCollections?: Record<string, FigmaVariableCollection>
  }
}

/** `GET /v1/files/{key}?depth=1` — the cheap read behind change detection. */
export interface FigmaFileMeta {
  name: string
  version: string
  lastModified: string
}
