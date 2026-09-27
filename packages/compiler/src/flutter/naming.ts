// flutter/naming.ts — the single source of every Dart identifier the Flutter
// target emits.
//
// Shared by the theme emitters, the widget stubs AND `fix.ts`, so the Janitor's
// rewrite (`Color(0xFF…)` → token) always names an identifier the generated
// `lib/theme/*.dart` actually declares. `export.flutterNaming` picks the shape:
//   prefixed-class  AppColors.primary   (static const members of a namespace class)
//   snake_const     c_primary           (top-level const, group-prefixed snake)
//   raw             kColorPrimary       (top-level const, Effective-Dart `k` style)
// Pure, deterministic.

import type { ExportConfig } from '../types/schema.js'

export type FlutterNaming = ExportConfig['flutterNaming']

/** Token groups the Flutter target declares identifiers for. */
export type FlutterGroup =
  | 'colors'
  | 'colorsDark'
  | 'typography'
  | 'spacing'
  | 'rounded'
  | 'borderWidth'
  | 'shadows'
  | 'breakpoints'

const CLASS: Record<FlutterGroup, string> = {
  colors: 'AppColors',
  colorsDark: 'AppColorsDark',
  typography: 'AppTypography',
  spacing: 'AppSpacing',
  rounded: 'AppRadius',
  borderWidth: 'AppBorders',
  shadows: 'AppShadows',
  breakpoints: 'AppBreakpoints',
}

const SNAKE: Record<FlutterGroup, string> = {
  colors: 'c_',
  colorsDark: 'c_dark_',
  typography: 't_',
  spacing: 's_',
  rounded: 'r_',
  borderWidth: 'bw_',
  shadows: 'sh_',
  breakpoints: 'bp_',
}

const RAW: Record<FlutterGroup, string> = {
  colors: 'kColor',
  colorsDark: 'kColorDark',
  typography: 'kText',
  spacing: 'kSpacing',
  rounded: 'kRadius',
  borderWidth: 'kBorderWidth',
  shadows: 'kShadow',
  breakpoints: 'kBreakpoint',
}

/**
 * Dart reserved words (contextual keywords like `base` are legal members),
 * plus names a static member / field / enum value may not take (`hashCode`
 * et al. clash with Object members; `values`/`index` with enums; `key` with
 * the widget constructor).
 */
const RESERVED = new Set([
  'assert', 'break', 'case', 'catch', 'class', 'const', 'continue', 'default', 'do', 'else', 'enum',
  'extends', 'false', 'final', 'finally', 'for', 'if', 'in', 'is', 'new', 'null', 'rethrow', 'return',
  'super', 'switch', 'this', 'throw', 'true', 'try', 'var', 'void', 'while', 'with',
  // built-ins that read ambiguously as a const member name
  'get', 'set', 'operator',
  'hashCode', 'runtimeType', 'toString', 'noSuchMethod', 'values', 'index', 'key',
])

/** Split any token name (kebab, snake, camel, spaced) into lowercase words. */
export function words(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase())
}

const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1)

/** snake_case a name: `onSurface` / `on-surface` → `on_surface`. */
export function snake(name: string): string {
  return words(name).join('_')
}

/** PascalCase a name: `on-surface` → `OnSurface`. */
export function pascalWords(name: string): string {
  return words(name).map(cap).join('')
}

/**
 * A valid lowerCamel Dart member identifier: `on-surface` → `onSurface`,
 * `2xl` → `x2xl` (identifiers can't start with a digit), `default` →
 * `defaultToken` (reserved). Empty input → `token`.
 */
export function dartIdent(name: string): string {
  const ws = words(name)
  if (ws.length === 0) return 'token'
  let id = ws[0] + ws.slice(1).map(cap).join('')
  if (/^[0-9]/.test(id)) id = `x${id}`
  if (RESERVED.has(id)) id = `${id}Token`
  return id
}

/** The bare declared name for a token (what follows `AppColors.` / is the const). */
function declName(naming: FlutterNaming, group: FlutterGroup, name: string): string {
  switch (naming) {
    case 'snake_const':
      return `${SNAKE[group]}${snake(name) || 'token'}`
    case 'raw':
      return `${RAW[group]}${pascalWords(name) || 'Token'}`
    default:
      return dartIdent(name)
  }
}

/** The expression that references a token, e.g. `AppColors.primary` / `c_primary` / `kColorPrimary`. */
export function flutterRef(naming: FlutterNaming, group: FlutterGroup, name: string): string {
  const id = declName(naming, group, name)
  return naming === 'snake_const' || naming === 'raw' ? id : `${CLASS[group]}.${id}`
}

/** Map a `{group.name}` schema path to its Flutter group + token name, or null. */
export function flutterGroupOf(path: string): { group: FlutterGroup; name: string } | null {
  const seg = path.split('.')
  if (seg[0] === 'borders' && seg[1] === 'width' && seg.length > 2) {
    return { group: 'borderWidth', name: seg.slice(2).join('.') }
  }
  const map: Record<string, FlutterGroup> = {
    colors: 'colors',
    typography: 'typography',
    spacing: 'spacing',
    rounded: 'rounded',
    shadows: 'shadows',
    breakpoints: 'breakpoints',
  }
  const group = map[seg[0]]
  return group && seg.length > 1 ? { group, name: seg.slice(1).join('.') } : null
}

/** Reference a schema path (`colors.on-surface`) in the given naming mode, or null if not a Flutter token. */
export function flutterRefForPath(naming: FlutterNaming, path: string): string | null {
  const g = flutterGroupOf(path)
  return g ? flutterRef(naming, g.group, g.name) : null
}

export interface DartDecl {
  /** Schema token name (pre-identifier). */
  name: string
  /** Dart const expression for the value. */
  value: string
  /** Optional trailing `//` note (e.g. dropped CSS features). */
  note?: string
}

/**
 * Declare one token group as Dart source lines. prefixed-class wraps the
 * members in an `abstract final class` namespace; the other modes emit
 * top-level consts. Two names that collapse to one identifier keep the first
 * (a duplicate would not compile) and leave a comment.
 */
export function declareGroup(
  naming: FlutterNaming,
  group: FlutterGroup,
  type: string,
  decls: DartDecl[],
  doc: string,
): string[] {
  const seen = new Set<string>()
  const members: string[] = []
  const classed = naming === 'prefixed-class'
  const indent = classed ? '  ' : ''
  for (const d of decls) {
    const id = declName(naming, group, d.name)
    if (seen.has(id)) {
      members.push(`${indent}// skipped "${d.name}": identifier ${id} already declared`)
      continue
    }
    seen.add(id)
    const note = d.note ? ` // ${d.note}` : ''
    members.push(`${indent}${classed ? 'static ' : ''}const ${type} ${id} = ${d.value};${note}`)
  }

  const lines = [`/// ${doc}`]
  if (classed) {
    lines.push(`abstract final class ${CLASS[group]} {`, ...members, '}')
  } else {
    lines.push(...members)
  }
  return lines
}

/** Lint suppression the non-class modes need (snake_const breaks lowerCamel). */
export function lintHeader(naming: FlutterNaming): string[] {
  return naming === 'snake_const' ? ['// ignore_for_file: non_constant_identifier_names, constant_identifier_names'] : []
}

export const DART_HEADER = [
  '// Generated by design-spec — do not edit by hand.',
  '// Source of truth: design-spec.schema.json. Run `design-spec compile` to regenerate.',
]
