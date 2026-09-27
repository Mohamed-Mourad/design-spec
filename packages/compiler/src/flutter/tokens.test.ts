// tokens.test.ts — golden + unit coverage for the Flutter theme emitters
// (lib/theme/*.dart) across every `flutterNaming` mode.

import { describe, it, expect } from 'vitest'
import type { DesignSystemSchema } from '../types/schema.js'
import { minimalSchema } from '../fixtures/minimal.fixture.js'
import { FLUTTER_NAMINGS, flutterSchema, withNaming } from '../fixtures/flutter.fixture.js'
import { compileFlutterTokens } from './index.js'
import { dartIdent, flutterRef, flutterRefForPath, snake, pascalWords } from './naming.js'
import { textStyle } from './typography.js'
import { parseShadow, toPx, hexToArgb, num } from './values.js'
import { colorRoles, textRoles } from './theme.js'

const file = (files: { filename: string; content: string }[], name: string) =>
  files.find((f) => f.filename === `lib/theme/${name}`)!.content

describe('flutter naming', () => {
  it.each([
    ['primary', 'primary'],
    ['on-surface', 'onSurface'],
    ['headline_lg', 'headlineLg'],
    ['onSurface', 'onSurface'],
    ['2xl', 'x2xl'],
    ['default', 'defaultToken'],
    ['values', 'valuesToken'],
    ['', 'token'],
  ])('dartIdent(%j) → %s', (name, id) => {
    expect(dartIdent(name)).toBe(id)
  })

  it('snake/pascal handle camel and kebab input alike', () => {
    expect(snake('onSurface')).toBe('on_surface')
    expect(snake('on-surface')).toBe('on_surface')
    expect(pascalWords('body-md')).toBe('BodyMd')
  })

  it.each([
    ['prefixed-class', 'AppColors.onSurface', 'AppSpacing.x2xl', 'AppBorders.thin'],
    ['snake_const', 'c_on_surface', 's_2xl', 'bw_thin'],
    ['raw', 'kColorOnSurface', 'kSpacing2xl', 'kBorderWidthThin'],
  ] as const)('%s references tokens by the documented convention', (naming, color, spacing, border) => {
    expect(flutterRef(naming, 'colors', 'on-surface')).toBe(color)
    expect(flutterRef(naming, 'spacing', '2xl')).toBe(spacing)
    expect(flutterRefForPath(naming, 'borders.width.thin')).toBe(border)
  })

  it('maps schema paths to groups and rejects non-Flutter paths', () => {
    expect(flutterRefForPath('prefixed-class', 'colors.primary')).toBe('AppColors.primary')
    expect(flutterRefForPath('prefixed-class', 'typography.body-md')).toBe('AppTypography.bodyMd')
    expect(flutterRefForPath('prefixed-class', 'zIndex.modal')).toBeNull()
    expect(flutterRefForPath('prefixed-class', 'colors')).toBeNull()
  })
})

describe('flutter values', () => {
  it('converts CSS lengths to logical px', () => {
    expect(toPx('16px')).toBe(16)
    expect(toPx('1.5rem')).toBe(24)
    expect(toPx(0)).toBe(0)
    expect(toPx('50%')).toBeNull()
    expect(toPx(undefined)).toBeNull()
  })

  it('formats numbers without float noise', () => {
    expect(num(0.1 + 0.2)).toBe('0.3')
    expect(num(-0)).toBe('0')
  })

  it('expands 3-digit hex and encodes alpha', () => {
    expect(hexToArgb('#26e')).toBe('0xFF2266EE')
    expect(hexToArgb('#000000', 0.05)).toBe('0x0D000000')
    expect(hexToArgb('red')).toBeNull()
  })

  it('parses rgba box-shadows and drops inset / unparseable layers', () => {
    const { layers, dropped } = parseShadow(['0 1px 2px rgba(15, 23, 42, 0.05)', 'inset 0 0 0 1px #000', 'glow'])
    expect(layers).toEqual(['BoxShadow(color: Color(0x0D0F172A), offset: Offset(0, 1), blurRadius: 2, spreadRadius: 0)'])
    expect(dropped).toEqual(['inset 0 0 0 1px #000', 'glow'])
    expect(parseShadow('0 2px 4px', true).dropped).toEqual(['0 2px 4px'])
  })

  it('maps typography to TextStyle with M3 semantics', () => {
    const t = textStyle({
      fontFamily: '"Space Grotesk", sans-serif',
      fontSize: '32px',
      fontWeight: 650,
      lineHeight: '40px',
      letterSpacing: '-0.02em',
      textTransform: 'uppercase',
    })
    expect(t.value).toBe(
      "TextStyle(fontFamily: 'Space Grotesk', fontFamilyFallback: ['sans-serif'], fontSize: 32, fontWeight: FontWeight.w700, height: 1.25, letterSpacing: -0.64)",
    )
    expect(t.note).toContain('textTransform: uppercase')
  })
})

describe('flutter theme roles', () => {
  it('pins exact M3 roles first, then aliases', () => {
    expect(colorRoles({ primary: '#000000', border: '#111111', 'on-surface': '#222222' })).toEqual([
      ['primary', 'primary'],
      ['onSurface', 'on-surface'],
      ['outline', 'border'],
    ])
    expect(colorRoles({ border: '#111111', outline: '#222222' })).toEqual([['outline', 'outline']])
  })

  it('maps type-scale names to TextTheme slots', () => {
    expect(textRoles({ 'headline-lg': 1, 'body-md': 1, 'label-small': 1, 'caption': 1, 'hero-lg': 1 })).toEqual([
      ['headlineLarge', 'headline-lg'],
      ['bodyMedium', 'body-md'],
      ['labelSmall', 'label-small'],
    ])
  })
})

describe('golden — Flutter theme files', () => {
  it.each(FLUTTER_NAMINGS)('%s', (naming) => {
    expect(compileFlutterTokens(withNaming(naming))).toMatchSnapshot()
  })

  it('emits the four lib/theme files in a fixed order', () => {
    expect(compileFlutterTokens(flutterSchema).map((f) => [f.filename, f.language])).toEqual([
      ['lib/theme/app_colors.dart', 'dart'],
      ['lib/theme/app_typography.dart', 'dart'],
      ['lib/theme/app_spacing.dart', 'dart'],
      ['lib/theme/app_theme.dart', 'dart'],
    ])
  })

  it('is deterministic', () => {
    expect(JSON.stringify(compileFlutterTokens(flutterSchema))).toBe(JSON.stringify(compileFlutterTokens(flutterSchema)))
  })

  it('keeps color literals out of app_theme.dart', () => {
    for (const naming of FLUTTER_NAMINGS) {
      expect(file(compileFlutterTokens(withNaming(naming)), 'app_theme.dart')).not.toMatch(/Color\(0x/)
    }
  })

  it('builds the dark theme from ThemeData.dark() only when dark mode is on', () => {
    const on = file(compileFlutterTokens(flutterSchema), 'app_theme.dart')
    expect(on).toContain('ThemeData.dark(useMaterial3: true)')
    expect(on).toContain('seedColor: AppColorsDark.primary')
    expect(file(compileFlutterTokens(flutterSchema), 'app_colors.dart')).toContain('abstract final class AppColorsDark')

    const off = compileFlutterTokens(minimalSchema)
    expect(file(off, 'app_theme.dart')).not.toContain('ThemeData.dark')
    expect(file(off, 'app_colors.dart')).not.toContain('AppColorsDark')
  })

  it('snake_const emits top-level consts with a lint suppression', () => {
    const colors = file(compileFlutterTokens(withNaming('snake_const')), 'app_colors.dart')
    expect(colors).toContain('// ignore_for_file: non_constant_identifier_names')
    expect(colors).toContain('const Color c_on_surface = Color(0xFF0F172A);')
    expect(colors).not.toContain('class ')
  })

  it('survives edge schemas: no colors, no type scale, duplicate identifiers', () => {
    const edge: DesignSystemSchema = {
      ...minimalSchema,
      colors: {},
      typography: { caption: { fontFamily: 'Inter', fontSize: '12px', fontWeight: 400, lineHeight: '1.4' } },
      spacing: { 'on-top': '4px', onTop: '8px', weird: '50%' },
    }
    const out = compileFlutterTokens(edge)
    expect(file(out, 'app_theme.dart')).toContain('seedColor: Color(0xFF6750A4)')
    expect(file(out, 'app_theme.dart')).not.toContain('textTheme')
    expect(file(out, 'app_spacing.dart')).toContain('// skipped "onTop": identifier onTop already declared')
    expect(file(out, 'app_spacing.dart')).not.toContain('weird')
  })
})
