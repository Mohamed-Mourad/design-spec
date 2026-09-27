// widgets.test.ts — golden + behavior coverage for the Flutter widget stubs
// (lib/widgets/{Name}/{name}.dart) across every `flutterNaming` mode.

import { describe, it, expect } from 'vitest'
import { minimalSchema } from '../fixtures/minimal.fixture.js'
import { FLUTTER_NAMINGS, flutterSchema, flutterEdgeSchema, withNaming } from '../fixtures/flutter.fixture.js'
import { compileFlutterWidgets } from './widgets.js'

const widget = (schema: typeof flutterSchema, path: string) =>
  compileFlutterWidgets(schema).find((f) => f.filename === path)!.content

describe('golden — Flutter widget stubs', () => {
  it.each(FLUTTER_NAMINGS)('%s (responsive Button + Input)', (naming) => {
    expect(compileFlutterWidgets(withNaming(naming))).toMatchSnapshot()
  })

  it.each(FLUTTER_NAMINGS)('%s (edge blueprints)', (naming) => {
    expect(compileFlutterWidgets(withNaming(naming, flutterEdgeSchema))).toMatchSnapshot()
  })

  it('names files lib/widgets/{ComponentName}/{component_name}.dart', () => {
    expect(compileFlutterWidgets(flutterEdgeSchema).map((f) => [f.filename, f.language])).toEqual([
      ['lib/widgets/StatCard/stat_card.dart', 'dart'],
      ['lib/widgets/Divider/divider.dart', 'dart'],
      ['lib/widgets/Empty/empty.dart', 'dart'],
    ])
  })

  it('is deterministic', () => {
    expect(JSON.stringify(compileFlutterWidgets(flutterEdgeSchema))).toBe(JSON.stringify(compileFlutterWidgets(flutterEdgeSchema)))
  })
})

describe('Flutter widget responsiveness', () => {
  const button = widget(flutterSchema, 'lib/widgets/Button/button.dart')

  it('wraps the widget in a LayoutBuilder — never a media query', () => {
    expect(button).toContain('return LayoutBuilder(')
    expect(button).not.toMatch(/MediaQuery|@media/)
  })

  it('applies breakpoint overrides mobile-first against schema.breakpoints', () => {
    const tablet = button.indexOf('if (width >= AppBreakpoints.tablet) t = t.merge(atTablet);')
    const desktop = button.indexOf('if (width >= AppBreakpoints.desktop) t = t.merge(atDesktop);')
    expect(tablet).toBeGreaterThan(-1)
    expect(desktop).toBeGreaterThan(tablet)
    expect(button).toContain('paddingX: AppSpacing.lg')
  })

  it('uses the breakpoint identifier of the active naming mode', () => {
    expect(widget(withNaming('snake_const'), 'lib/widgets/Button/button.dart')).toContain('if (width >= bp_tablet)')
    expect(widget(withNaming('raw'), 'lib/widgets/Button/button.dart')).toContain('if (width >= kBreakpointTablet)')
  })

  it('hides per breakpoint via visibleAt and skips an unknown breakpoint with a TODO', () => {
    const card = widget(flutterEdgeSchema, 'lib/widgets/StatCard/stat_card.dart')
    expect(card).toContain('if (!_StatCardTokens.visibleAt(constraints.maxWidth)) return const SizedBox.shrink();')
    expect(card).toContain('if (width >= AppBreakpoints.tablet) visible = false;')
    expect(card).toContain('// TODO: breakpoint "mystery" is not in schema.breakpoints — skipped.')
  })

  it('emits a plain resolver when there is no cascade', () => {
    const input = widget(minimalSchema, 'lib/widgets/Input/input.dart')
    expect(input).toContain('static _InputTokens resolve(double width) {\n    return base;\n  }')
  })
})

describe('Flutter widget tokens + props', () => {
  const card = widget(flutterEdgeSchema, 'lib/widgets/StatCard/stat_card.dart')

  it('references tokens, maps an exact-match literal to its token, keeps other literals', () => {
    expect(card).toContain('backgroundColor: AppColors.surface') // '#FFFFFF' === colors.surface
    expect(card).toContain('textColor: Color(0xFF123456)') // no matching token
    expect(card).toContain('borderColor: AppColors.border') // {borders.color.default} → {colors.border}
    expect(card).toContain('shadow: AppShadows.md')
    expect(card).toContain('radius: 12')
  })

  it('types props: required, enums with defaults, reserved names, slots', () => {
    expect(card).toContain('required this.value')
    expect(card).toContain('enum StatCardTone { defaultToken, accent }')
    expect(card).toContain('this.tone = StatCardTone.defaultToken')
    expect(card).toContain('final StatCardTrend? trend;')
    expect(card).toContain('this.precision = 2')
    expect(card).toContain('this.inToken = true')
    expect(card).toContain('required this.child')
    expect(card).toContain('final String? loose;')
    expect(card).toContain('child: DefaultTextStyle.merge(style: TextStyle(color: t.textColor), child: child)')
  })

  it('drops dangling refs instead of pointing at an undeclared identifier', () => {
    const empty = widget(flutterEdgeSchema, 'lib/widgets/Empty/empty.dart')
    expect(empty).not.toContain('missing')
    expect(empty).not.toContain('_EmptyTokens')
  })

  it('wires action widgets to onPressed with disabled/loading guards', () => {
    const button = widget(flutterSchema, 'lib/widgets/Button/button.dart')
    expect(button).toContain('final enabled = onPressed != null && !disabled && !loading;')
    expect(button).toContain('enum ButtonVariant { primary, secondary }')
  })

  it('renders form widgets as a token-styled TextField', () => {
    const input = widget(flutterSchema, 'lib/widgets/Input/input.dart')
    expect(input).toContain('final field = TextField(')
    expect(input).toContain('labelText: label,')
    expect(input).toContain('errorText: error,')
    expect(input).toContain('enabled: !disabled,')
  })

  it('imports only the theme files it references', () => {
    const divider = widget(flutterEdgeSchema, 'lib/widgets/Divider/divider.dart')
    expect(divider).toContain("import '../../theme/app_spacing.dart';")
    expect(divider).not.toContain('app_colors.dart')
    expect(divider).toContain('width: 1200') // {layout.container.maxWidth} followed to its value
  })
})
