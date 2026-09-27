// flutter/widgets.ts — component blueprints → lib/widgets/{Name}/{name}.dart.
//
// Pure (schema) => FileOutput[], deterministic. One StatelessWidget stub per
// blueprint: typed fields from the blueprint's props, a private const
// `_{Name}Tokens` holding the base / per-variant / per-breakpoint token sets as
// references into lib/theme, and a `LayoutBuilder` that applies the responsive
// cascade mobile-first against `schema.breakpoints` (Flutter has no media
// queries). Breakpoint order and override merging reuse `orderBreakpoints` /
// `mergeTokens`, the same cascade the React and Vue stubs emit.

import type { DesignSystemSchema, ComponentBlueprint, PropDefinition } from '../types/schema.js'
import type { FileOutput } from '../types/compiler.js'
import { orderBreakpoints, mergeTokens, type BreakpointLayer } from '../resolveResponsive.js'
import { refPath, getPath } from '../tokenResolver.js'
import { pascal } from '../components/shared.js'
import {
  DART_HEADER,
  dartIdent,
  flutterGroupOf,
  flutterRef,
  lintHeader,
  pascalWords,
  snake,
  type FlutterGroup,
  type FlutterNaming,
} from './naming.js'
import { colorLiteral, num, toPx } from './values.js'
import { shadowList } from './spacing.js'

type Kind = 'color' | 'length' | 'text' | 'shadow'

/** Schema token prop → `_Tokens` field (name, Dart type, value kind). Order = emission order. */
const FIELDS: Array<{ prop: string; field: string; type: string; kind: Kind }> = [
  { prop: 'backgroundColor', field: 'backgroundColor', type: 'Color', kind: 'color' },
  { prop: 'textColor', field: 'textColor', type: 'Color', kind: 'color' },
  { prop: 'typography', field: 'textStyle', type: 'TextStyle', kind: 'text' },
  { prop: 'borderColor', field: 'borderColor', type: 'Color', kind: 'color' },
  { prop: 'borderWidth', field: 'borderWidth', type: 'double', kind: 'length' },
  { prop: 'rounded', field: 'radius', type: 'double', kind: 'length' },
  { prop: 'shadow', field: 'shadow', type: 'List<BoxShadow>', kind: 'shadow' },
  { prop: 'padding', field: 'padding', type: 'double', kind: 'length' },
  { prop: 'paddingX', field: 'paddingX', type: 'double', kind: 'length' },
  { prop: 'paddingY', field: 'paddingY', type: 'double', kind: 'length' },
  { prop: 'size', field: 'size', type: 'double', kind: 'length' },
  { prop: 'width', field: 'width', type: 'double', kind: 'length' },
  { prop: 'height', field: 'height', type: 'double', kind: 'length' },
]

/** The theme file each token group is declared in. */
const THEME_FILE: Record<FlutterGroup, string> = {
  colors: 'app_colors.dart',
  colorsDark: 'app_colors.dart',
  typography: 'app_typography.dart',
  spacing: 'app_spacing.dart',
  rounded: 'app_spacing.dart',
  borderWidth: 'app_spacing.dart',
  shadows: 'app_spacing.dart',
  breakpoints: 'app_spacing.dart',
}

/** Per-file emission context: naming mode + the theme files actually referenced. */
class Ctx {
  readonly imports = new Set<string>()
  constructor(
    readonly schema: DesignSystemSchema,
    readonly naming: FlutterNaming,
  ) {}

  ref(group: FlutterGroup, name: string): string {
    this.imports.add(THEME_FILE[group])
    return flutterRef(this.naming, group, name)
  }
}

/** A literal hex → the color token with that exact value, or a `Color(…)` literal. */
function colorValue(ctx: Ctx, hex: string): string | null {
  const match = Object.entries(ctx.schema.colors).find(([, v]) => v.toUpperCase() === hex.toUpperCase())
  return match ? ctx.ref('colors', match[0]) : colorLiteral(hex)
}

/** Render one token value as a Dart const expression, or null if it can't be expressed. */
function renderValue(ctx: Ctx, kind: Kind, value: unknown, depth = 0): string | null {
  const path = refPath(value)
  if (path !== null) {
    const next = getPath(ctx.schema, path)
    if (next === undefined) return null // dangling ref — nothing to point at
    const g = flutterGroupOf(path)
    if (g && g.group === 'colors' && kind === 'color') return ctx.ref('colors', g.name)
    if (g && g.group === 'typography' && kind === 'text') return ctx.ref('typography', g.name)
    if (g && g.group === 'shadows' && kind === 'shadow') return ctx.ref('shadows', g.name)
    if (g && kind === 'length' && ['spacing', 'rounded', 'borderWidth', 'breakpoints'].includes(g.group)) {
      return ctx.ref(g.group, g.name)
    }
    // Anything else (`{borders.color.x}`, `{layout.…}`) — follow the ref one hop.
    return depth > 4 ? null : renderValue(ctx, kind, next, depth + 1)
  }
  switch (kind) {
    case 'color':
      return typeof value === 'string' ? colorValue(ctx, value) : null
    case 'length': {
      const px = toPx(value)
      return px === null ? null : num(px)
    }
    case 'shadow':
      return typeof value === 'string' ? shadowList(value).value : null
    default:
      return null
  }
}

/** `_{Name}Tokens(...)` const constructor args for one token group. */
function tokenArgs(ctx: Ctx, group: Record<string, unknown> | undefined): string[] {
  const out: string[] = []
  for (const f of FIELDS) {
    const v = group?.[f.prop]
    if (v === undefined || v === null) continue
    const rendered = renderValue(ctx, f.kind, v)
    if (rendered !== null) out.push(`${f.field}: ${rendered}`)
  }
  return out
}

/** A widget prop as a Dart field + constructor parameter. */
interface DartProp {
  field: string
  type: string
  param: string
  doc?: string
  enumDecl?: string[]
}

function enumType(Name: string, prop: string): string {
  return `${Name}${pascalWords(prop)}`
}

function dartProp(Name: string, name: string, def: PropDefinition): DartProp {
  const field = name === 'children' ? 'child' : dartIdent(name)
  const req = def.required === true
  const base = { field, doc: def.description }
  switch (def.type) {
    case 'boolean': {
      if (req) return { ...base, type: 'bool', param: `required this.${field}` }
      return { ...base, type: 'bool', param: `this.${field} = ${def.default === true}` }
    }
    case 'number': {
      if (req) return { ...base, type: 'double', param: `required this.${field}` }
      if (typeof def.default === 'number') return { ...base, type: 'double', param: `this.${field} = ${num(def.default)}` }
      return { ...base, type: 'double?', param: `this.${field}` }
    }
    case 'enum': {
      const values = def.values ?? []
      if (values.length === 0) return { ...base, type: req ? 'String' : 'String?', param: `${req ? 'required ' : ''}this.${field}` }
      const T = enumType(Name, name)
      const enumDecl = [`enum ${T} { ${values.map(dartIdent).join(', ')} }`]
      if (req) return { ...base, type: T, param: `required this.${field}`, enumDecl }
      if (typeof def.default === 'string' && values.includes(def.default)) {
        return { ...base, type: T, param: `this.${field} = ${T}.${dartIdent(def.default)}`, enumDecl }
      }
      return { ...base, type: `${T}?`, param: `this.${field}`, enumDecl }
    }
    case 'slot':
      return { ...base, type: req ? 'Widget' : 'Widget?', param: `${req ? 'required ' : ''}this.${field}` }
    default:
      return { ...base, type: req ? 'String' : 'String?', param: `${req ? 'required ' : ''}this.${field}` }
  }
}

/** Fields the token class needs: every prop some group / breakpoint of this blueprint renders. */
function usedFields(ctx: Ctx, groups: Array<Record<string, unknown> | undefined>): typeof FIELDS {
  return FIELDS.filter((f) => groups.some((g) => g?.[f.prop] != null && renderValue(ctx, f.kind, g[f.prop]) !== null))
}

function has(fields: typeof FIELDS, field: string): boolean {
  return fields.some((f) => f.field === field)
}

/** `a ?? b ?? 0` over whichever of the named fields exist. */
function coalesce(fields: typeof FIELDS, names: string[], fallback: string): string {
  const present = names.filter((n) => has(fields, n)).map((n) => `t.${n}`)
  return [...present, ...(fallback ? [fallback] : [])].join(' ?? ')
}

/** Resolved token-class body lines (the `build` inner expression) for the widget's category. */
function buildBody(bp: ComponentBlueprint, fields: typeof FIELDS, props: Map<string, DartProp>): string[] {
  const textStyle = has(fields, 'textStyle') || has(fields, 'textColor')
  const style = has(fields, 'textStyle')
    ? `(t.textStyle ?? const TextStyle())${has(fields, 'textColor') ? '.copyWith(color: t.textColor)' : ''}`
    : 'TextStyle(color: t.textColor)'
  const padding = ['padding', 'paddingX', 'paddingY'].some((n) => has(fields, n))
    ? `EdgeInsets.symmetric(horizontal: ${coalesce(fields, ['paddingX', 'padding'], '0')}, vertical: ${coalesce(fields, ['paddingY', 'padding'], '0')})`
    : null
  const radius = has(fields, 'radius') ? 'BorderRadius.circular(t.radius ?? 0)' : null
  const width = has(fields, 'width') || has(fields, 'size') ? coalesce(fields, ['width', 'size'], '') : null
  const height = has(fields, 'height') || has(fields, 'size') ? coalesce(fields, ['height', 'size'], '') : null
  const str = (p: string) => (props.get(p)?.type.startsWith('String') ? props.get(p)!.field : null)
  const bool = (p: string) => (props.get(p)?.type === 'bool' ? props.get(p)!.field : null)

  if (bp.category === 'form') {
    const side = has(fields, 'borderColor')
      ? `t.borderColor == null ? BorderSide.none : BorderSide(color: t.borderColor!, width: ${coalesce(fields, ['borderWidth'], '1')})`
      : 'BorderSide.none'
    const border = `OutlineInputBorder(borderRadius: ${radius ?? 'BorderRadius.zero'}, borderSide: ${side})`
    const disabled = bool('disabled')
    const deco = [
      ...(str('label') ? [`labelText: ${str('label')},`] : []),
      ...(str('placeholder') ? [`hintText: ${str('placeholder')},`] : []),
      ...(str('helper') ? [`helperText: ${str('helper')},`] : []),
      ...(str('error') ? [`errorText: ${str('error')},`] : []),
      ...(has(fields, 'backgroundColor') ? ['filled: t.backgroundColor != null,', 'fillColor: t.backgroundColor,'] : []),
      ...(padding ? [`contentPadding: ${padding},`] : []),
      'border: border,',
      'enabledBorder: border,',
    ]
    return [
      `final border = ${border};`,
      'final field = TextField(',
      '  controller: controller,',
      '  onChanged: onChanged,',
      ...(disabled ? [`  enabled: !${disabled},`] : []),
      ...(textStyle ? [`  style: ${style},`] : []),
      '  decoration: InputDecoration(',
      ...deco.map((d) => `    ${d}`),
      '  ),',
      ');',
      width ? `return SizedBox(width: ${width}, child: field);` : 'return field;',
    ]
  }

  const loading = bool('loading')
  const slot = props.get('children')
  const content = !slot ? 'const SizedBox.shrink()' : slot.type.endsWith('?') ? 'child ?? const SizedBox.shrink()' : 'child'
  const inner = loading
    ? `${loading} ? const SizedBox.square(dimension: 16, child: CircularProgressIndicator(strokeWidth: 2)) : ${content}`
    : content
  const decoration: string[] = []
  if (has(fields, 'backgroundColor')) decoration.push('color: t.backgroundColor,')
  if (radius) decoration.push(`borderRadius: ${radius},`)
  if (has(fields, 'borderColor')) {
    decoration.push(`border: t.borderColor == null ? null : Border.all(color: t.borderColor!, width: ${coalesce(fields, ['borderWidth'], '1')}),`)
  } else if (has(fields, 'borderWidth')) {
    decoration.push('border: t.borderWidth == null ? null : Border.all(width: t.borderWidth!),')
  }
  if (has(fields, 'shadow')) decoration.push('boxShadow: t.shadow,')

  const bare = !width && !height && !padding && decoration.length === 0 && !textStyle
  const box = bare ? [`final Widget box = ${inner};`] : [
    'final box = Container(',
    ...(width ? [`  width: ${width},`] : []),
    ...(height ? [`  height: ${height},`] : []),
    ...(padding ? [`  padding: ${padding},`] : []),
    ...(decoration.length ? ['  decoration: BoxDecoration(', ...decoration.map((d) => `    ${d}`), '  ),'] : []),
    textStyle ? `  child: DefaultTextStyle.merge(style: ${style}, child: ${inner}),` : `  child: ${inner},`,
    ');',
  ]

  if (bp.category !== 'action') return [...box, 'return box;']
  const guards = ['onPressed != null', ...[bool('disabled'), loading].filter((b): b is string => b !== null).map((b) => `!${b}`)]
  return [
    ...box,
    `final enabled = ${guards.join(' && ')};`,
    'return Semantics(',
    '  button: true,',
    '  enabled: enabled,',
    '  child: MouseRegion(',
    '    cursor: enabled ? SystemMouseCursors.click : SystemMouseCursors.basic,',
    '    child: GestureDetector(onTap: enabled ? onPressed : null, child: box),',
    '  ),',
    ');',
  ]
}

function compileOne(schema: DesignSystemSchema, bp: ComponentBlueprint): FileOutput {
  const ctx = new Ctx(schema, schema.export.flutterNaming)
  const Name = pascal(bp.name)
  const T = `_${Name}Tokens`
  const multiVariant = bp.variants.length > 1
  const Variant = `${Name}Variant`

  // Props → fields. A multi-variant blueprint's `variant` prop is the Variant enum.
  const props = new Map<string, DartProp>()
  for (const [name, def] of Object.entries(bp.props)) {
    if (multiVariant && name === 'variant') continue
    props.set(name, dartProp(Name, name, def))
  }

  // Token cascade: base ⊕ variant ⊕ breakpoint layers (mobile-first).
  const base = bp.tokens.base as Record<string, unknown>
  const variantGroups = multiVariant
    ? bp.variants.map((v) => [v, bp.tokens[v] as Record<string, unknown> | undefined] as const)
    : []
  const layers = orderBreakpoints(schema, bp.responsive as Record<string, BreakpointLayer> | undefined)
  const bpGroups = layers.map((l) => mergeTokens({}, l.layer.tokens as Record<string, unknown> | undefined))
  const fields = usedFields(ctx, [base, ...variantGroups.map(([, g]) => g), ...bpGroups])

  const constDecl = (id: string, group: Record<string, unknown> | undefined): string[] => {
    const args = tokenArgs(ctx, group)
    return args.length
      ? [`  static const ${id} = ${T}(`, ...args.map((a) => `    ${a},`), '  );']
      : [`  static const ${id} = ${T}();`]
  }

  // Resolver body: start from base (merged with the variant), then each reached breakpoint.
  const start = multiVariant
    ? [
        'base.merge(switch (variant) {',
        ...variantGroups.map(([v]) => `      ${Variant}.${dartIdent(v)} => ${dartIdent(`variant-${v}`)},`),
        '    })',
      ].join('\n')
    : 'base'
  const steps: string[] = []
  const bpConsts: string[] = []
  const visibility: string[] = []
  layers.forEach((l, i) => {
    if (l.minWidth === null) {
      steps.push(`    // TODO: breakpoint "${l.name}" is not in schema.breakpoints — skipped.`)
      return
    }
    const threshold = ctx.ref('breakpoints', l.name)
    const id = dartIdent(`at-${l.name}`)
    if (tokenArgs(ctx, bpGroups[i]).length) {
      bpConsts.push(...constDecl(id, bpGroups[i]))
      steps.push(`    if (width >= ${threshold}) t = t.merge(${id});`)
    }
    if (l.layer.visibleAt !== undefined) visibility.push(`    if (width >= ${threshold}) visible = ${l.layer.visibleAt};`)
  })
  const resolveLines = steps.some((s) => s.includes('t.merge'))
    ? [`    var t = ${start};`, ...steps, '    return t;']
    : [...steps, `    return ${start};`]

  // Token class.
  const tokenClass = [
    `/// ${Name}'s design tokens: base, per-variant and per-breakpoint overrides.`,
    `class ${T} {`,
    fields.length ? `  const ${T}({${fields.map((f) => `this.${f.field}`).join(', ')}});` : `  const ${T}();`,
    '',
    ...fields.map((f) => `  final ${f.type}? ${f.field};`),
    ...(fields.length ? [''] : []),
    `  ${T} merge(${T} o) => ${fields.length ? `${T}(` : `const ${T}();`}`,
    ...(fields.length ? [...fields.map((f) => `        ${f.field}: o.${f.field} ?? ${f.field},`), '      );'] : []),
    '',
    ...constDecl('base', base),
    ...variantGroups.flatMap(([v, g]) => constDecl(dartIdent(`variant-${v}`), g)),
    ...bpConsts,
    '',
    `  /// Mobile-first cascade: base${multiVariant ? ', then the variant' : ''}, then each breakpoint the width reaches.`,
    `  static ${T} resolve(${multiVariant ? `${Variant} variant, ` : ''}double width) {`,
    ...resolveLines,
    '  }',
  ]
  if (visibility.length) {
    tokenClass.push('', '  static bool visibleAt(double width) {', '    var visible = true;', ...visibility, '    return visible;', '  }')
  }
  tokenClass.push('}')

  // Widget class.
  const ctorParams = [
    'super.key',
    ...(multiVariant ? [`this.variant = ${Variant}.${dartIdent(bp.variants[0])}`] : []),
    ...[...props.values()].map((p) => p.param),
    ...(bp.category === 'action' ? ['this.onPressed'] : []),
    ...(bp.category === 'form' ? ['this.controller', 'this.onChanged'] : []),
  ]
  const fieldLines = [
    ...(multiVariant ? [`  final ${Variant} variant;`] : []),
    ...[...props.values()].flatMap((p) => [...(p.doc ? [`  /// ${p.doc}`] : []), `  final ${p.type} ${p.field};`]),
    ...(bp.category === 'action' ? ['  final VoidCallback? onPressed;'] : []),
    ...(bp.category === 'form' ? ['  final TextEditingController? controller;', '  final ValueChanged<String>? onChanged;'] : []),
  ]
  const body = buildBody(bp, fields, props)
  const widget = [
    `/// ${bp.description}`,
    `class ${Name} extends StatelessWidget {`,
    `  const ${Name}({`,
    ...ctorParams.map((p) => `    ${p},`),
    '  });',
    '',
    ...(fieldLines.length ? [...fieldLines, ''] : []),
    '  @override',
    '  Widget build(BuildContext context) {',
    '    return LayoutBuilder(',
    '      builder: (context, constraints) {',
    ...(visibility.length ? [`        if (!${T}.visibleAt(constraints.maxWidth)) return const SizedBox.shrink();`] : []),
    ...(fields.length ? [`        final t = ${T}.resolve(${multiVariant ? 'variant, ' : ''}constraints.maxWidth);`] : []),
    ...body.map((l) => `        ${l}`),
    '      },',
    '    );',
    '  }',
    '}',
  ]

  const enums = [
    ...(multiVariant ? [`enum ${Variant} { ${bp.variants.map(dartIdent).join(', ')} }`] : []),
    ...[...props.values()].flatMap((p) => p.enumDecl ?? []),
  ]

  // Imports last: rendering above recorded which theme files are referenced.
  const imports = [...new Set([...ctx.imports])].sort().map((f) => `import '../../theme/${f}';`)
  const lines = [
    ...DART_HEADER,
    ...lintHeader(ctx.naming),
    '',
    "import 'package:flutter/material.dart';",
    ...(imports.length ? ['', ...imports] : []),
    '',
    ...(enums.length ? [...enums.flatMap((e) => [e, ''])] : []),
    ...widget,
    ...(fields.length || visibility.length ? ['', ...tokenClass] : []),
    '',
  ]
  return { filename: `lib/widgets/${Name}/${snake(Name)}.dart`, content: lines.join('\n'), language: 'dart' }
}

/** Compile every blueprint to a Flutter widget stub. */
export function compileFlutterWidgets(schema: DesignSystemSchema): FileOutput[] {
  return Object.values(schema.componentBlueprints).map((bp) => compileOne(schema, bp))
}
