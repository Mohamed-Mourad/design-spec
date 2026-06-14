import { orderBreakpoints } from '@design-spec/compiler'
import type { CSSProperties } from 'vue'
import type { ComponentBlueprint, DesignSystemSchema } from '@/types/schema'

// The showcase renders preview components using CSS custom properties injected
// by the center panel, so edits flow through live. This maps schema token refs
// to those vars and resolves a component's style at a given viewport width.

const GROUP_PREFIX: Record<string, string> = {
  colors: 'color',
  spacing: 'spacing',
  rounded: 'rounded',
  shadows: 'shadow',
}

/** `{colors.primary}` → `var(--color-primary)`; raw values pass through. */
export function refToVar(value: unknown): string {
  if (typeof value !== 'string') return String(value)
  const m = value.match(/^\{([^.]+)\.(.+)\}$/)
  if (!m) return value
  const prefix = GROUP_PREFIX[m[1]]
  return prefix ? `var(--${prefix}-${m[2]})` : value
}

function applyTypography(schema: DesignSystemSchema, ref: unknown, style: CSSProperties) {
  if (typeof ref !== 'string') return
  const m = ref.match(/^\{typography\.(.+)\}$/)
  const tok = m ? schema.typography[m[1]] : undefined
  if (!tok) return
  style.fontFamily = tok.fontFamily
  style.fontSize = String(tok.fontSize)
  style.fontWeight = tok.fontWeight
  style.lineHeight = String(tok.lineHeight)
  if (tok.letterSpacing) style.letterSpacing = tok.letterSpacing
  if (tok.textTransform) style.textTransform = tok.textTransform
}

function applyProp(schema: DesignSystemSchema, prop: string, value: unknown, style: CSSProperties) {
  switch (prop) {
    case 'backgroundColor':
      style.background = refToVar(value)
      break
    case 'textColor':
      style.color = refToVar(value)
      break
    case 'rounded':
      style.borderRadius = refToVar(value)
      break
    case 'padding':
      style.padding = refToVar(value)
      break
    case 'paddingX':
      style.paddingLeft = refToVar(value)
      style.paddingRight = refToVar(value)
      break
    case 'paddingY':
      style.paddingTop = refToVar(value)
      style.paddingBottom = refToVar(value)
      break
    case 'borderColor':
      style.borderColor = refToVar(value)
      style.borderStyle = 'solid'
      if (style.borderWidth === undefined) style.borderWidth = '1px'
      break
    case 'borderWidth':
      style.borderWidth = refToVar(value)
      style.borderStyle = 'solid'
      break
    case 'shadow':
      style.boxShadow = refToVar(value)
      break
    case 'size':
      style.width = refToVar(value)
      style.height = refToVar(value)
      break
    case 'height':
      style.height = refToVar(value)
      break
    case 'width':
      style.width = refToVar(value)
      break
    case 'typography':
      applyTypography(schema, value, style)
      break
  }
}

/**
 * Resolve a blueprint's render style at `width` px (Infinity = fit). Cascade:
 * base tokens → the named variant's overrides → each responsive override whose
 * breakpoint min-width is ≤ width (mobile-first). Returns the CSS plus whether
 * it's hidden at this width.
 */
export function resolveComponentStyle(
  schema: DesignSystemSchema,
  bp: ComponentBlueprint,
  width: number,
  variant?: string,
): { style: CSSProperties; hidden: boolean } {
  const style: CSSProperties = {}
  const base = bp.tokens.base ?? {}
  for (const [prop, value] of Object.entries(base)) {
    if (prop === 'responsive') continue
    applyProp(schema, prop, value, style)
  }

  // Variant overrides (e.g. secondary, destructive) layer over base.
  if (variant) {
    const group = bp.tokens[variant] as Record<string, unknown> | undefined
    if (group) {
      for (const [prop, value] of Object.entries(group)) {
        if (prop === 'responsive') continue
        applyProp(schema, prop, value, style)
      }
    }
  }

  let hidden = false
  const ordered = orderBreakpoints(schema, bp.responsive)
  for (const { minWidth, layer } of ordered) {
    const min = minWidth ? parseFloat(minWidth) : Number.POSITIVE_INFINITY
    if (width < min) continue
    if (layer.visibleAt === false) hidden = true
    for (const [prop, value] of Object.entries(layer.tokens ?? {})) {
      applyProp(schema, prop, value, style)
    }
  }
  return { style, hidden }
}
