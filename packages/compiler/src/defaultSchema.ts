// defaultSchema — the "Clean Professional" light baseline.
//
// `design-spec init` synthesizes a project schema by detecting framework
// signals and filling everything it cannot detect from this preset. It is also
// the seed for a fresh web-app session. Deterministic, no runtime values.

import type { DesignSystemSchema, ExportConfig } from './types/schema.js'

export const defaultExportConfig: ExportConfig = {
  frameworks: ['react-tailwind'],
  webNamingConvention: 'kebab-case',
  cssVariablePrefix: '',
  tailwindClassPrefix: '',
  flutterNaming: 'prefixed-class',
  fontLoading: 'auto',
  fontSource: 'google',
}

export const defaultSchema: DesignSystemSchema = {
  version: 'alpha',
  name: 'Clean Professional',
  description: 'A neutral, high-contrast light baseline for product UI.',

  overview: {
    brandPersonality: 'Professional, calm, trustworthy.',
    targetAudience: 'Product teams shipping web applications.',
    aestheticDirection: 'Clean, spacious, high-contrast neutrals with a single accent.',
    moodKeywords: ['professional', 'clean', 'modern', 'accessible'],
  },

  colors: {
    primary: '#2563EB',
    secondary: '#475569',
    neutral: '#0F172A',
    surface: '#FFFFFF',
    'on-surface': '#0F172A',
    muted: '#64748B',
    border: '#E2E8F0',
    error: '#DC2626',
    success: '#16A34A',
  },

  typography: {
    'headline-lg': { fontFamily: 'Inter', fontSize: '32px', fontWeight: 700, lineHeight: 1.15, letterSpacing: '-0.02em' },
    'headline-md': { fontFamily: 'Inter', fontSize: '24px', fontWeight: 600, lineHeight: 1.2 },
    'body-lg': { fontFamily: 'Inter', fontSize: '18px', fontWeight: 400, lineHeight: 1.6 },
    'body-md': { fontFamily: 'Inter', fontSize: '16px', fontWeight: 400, lineHeight: 1.6 },
    'body-sm': { fontFamily: 'Inter', fontSize: '14px', fontWeight: 400, lineHeight: 1.5 },
    'label-md': { fontFamily: 'Inter', fontSize: '14px', fontWeight: 500, lineHeight: 1.2 },
  },

  spacing: {
    base: '16px',
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '40px',
    '2xl': '64px',
  },

  rounded: {
    none: 0,
    sm: '4px',
    md: '8px',
    lg: '12px',
    full: '9999px',
  },

  shadows: {
    sm: { value: '0 1px 2px 0 rgba(15, 23, 42, 0.05)' },
    md: { value: '0 4px 6px -1px rgba(15, 23, 42, 0.1)' },
    lg: { value: '0 10px 15px -3px rgba(15, 23, 42, 0.1)' },
  },

  borders: {
    width: { thin: '1px', thick: '2px' },
    color: { default: '{colors.border}', strong: '{colors.neutral}' },
  },

  transitions: {
    duration: { fast: '120ms', base: '200ms', slow: '320ms' },
    easing: { standard: 'cubic-bezier(0.4, 0, 0.2, 1)', emphasized: 'cubic-bezier(0.2, 0, 0, 1)' },
    reducedMotion: true,
  },

  breakpoints: {
    tablet: '768px',
    desktop: '1024px',
    wide: '1280px',
  },

  zIndex: {
    base: 0,
    dropdown: 1000,
    sticky: 1100,
    overlay: 1300,
    modal: 1400,
    toast: 1600,
  },

  opacity: {
    disabled: 0.4,
    muted: 0.6,
    full: 1,
  },

  icons: {
    library: 'lucide',
    size: { sm: '16px', md: '20px', lg: '24px' },
  },

  layout: {
    grid: { columns: 12, gutter: '{spacing.lg}', margin: '{spacing.xl}' },
    container: { maxWidth: '1200px', paddingX: '{spacing.lg}' },
  },

  components: {
    'button-primary': {
      backgroundColor: '{colors.primary}',
      textColor: '{colors.surface}',
      rounded: '{rounded.md}',
      paddingX: '{spacing.md}',
      paddingY: '{spacing.sm}',
      typography: '{typography.label-md}',
    },
    'button-primary-hover': {
      backgroundColor: '#1D4ED8',
    },
    'button-secondary': {
      backgroundColor: '{colors.surface}',
      textColor: '{colors.primary}',
      borderColor: '{colors.border}',
      borderWidth: '{borders.width.thin}',
      rounded: '{rounded.md}',
      paddingX: '{spacing.md}',
      paddingY: '{spacing.sm}',
      typography: '{typography.label-md}',
    },
    'input-default': {
      backgroundColor: '{colors.surface}',
      textColor: '{colors.on-surface}',
      borderColor: '{colors.border}',
      borderWidth: '{borders.width.thin}',
      rounded: '{rounded.md}',
      paddingX: '{spacing.md}',
      paddingY: '{spacing.sm}',
      typography: '{typography.body-md}',
    },
  },

  componentBlueprints: {
    Button: {
      name: 'Button',
      description: 'A clickable action trigger. Primary drives the single most important action per view.',
      category: 'action',
      variants: ['primary', 'secondary'],
      sizes: ['sm', 'md', 'lg'],
      states: ['default', 'hover', 'focus', 'disabled', 'loading'],
      anatomy: ['root', 'label', 'icon', 'spinner'],
      props: {
        variant: { type: 'enum', values: ['primary', 'secondary'], default: 'primary' },
        size: { type: 'enum', values: ['sm', 'md', 'lg'], default: 'md' },
        disabled: { type: 'boolean', default: false },
        loading: { type: 'boolean', default: false },
        children: { type: 'slot', description: 'Button label content.' },
      },
      tokens: {
        base: {
          backgroundColor: '{colors.primary}',
          textColor: '{colors.surface}',
          rounded: '{rounded.md}',
          paddingX: '{spacing.md}',
          paddingY: '{spacing.sm}',
          typography: '{typography.label-md}',
        },
        secondary: {
          backgroundColor: '{colors.surface}',
          textColor: '{colors.primary}',
          borderColor: '{colors.border}',
          borderWidth: '{borders.width.thin}',
        },
      },
      examples: [
        { label: 'Primary action', props: { variant: 'primary', children: 'Save changes' } },
        { label: 'Secondary action', props: { variant: 'secondary', children: 'Cancel' } },
      ],
      dosDonts: {
        dos: ['Use one primary button per view.', 'Show a spinner in the loading state.'],
        donts: ["Don't use inline hex — reference color tokens."],
      },
    },
    Input: {
      name: 'Input',
      description: 'A single-line text field with label, helper text, and error states.',
      category: 'form',
      variants: ['default'],
      sizes: ['md'],
      states: ['default', 'focus', 'disabled', 'error'],
      anatomy: ['root', 'label', 'field', 'helper'],
      props: {
        label: { type: 'string' },
        placeholder: { type: 'string' },
        disabled: { type: 'boolean', default: false },
        error: { type: 'string', description: 'Error message; switches the field to its error state.' },
      },
      tokens: {
        base: {
          backgroundColor: '{colors.surface}',
          textColor: '{colors.on-surface}',
          borderColor: '{colors.border}',
          borderWidth: '{borders.width.thin}',
          rounded: '{rounded.md}',
          paddingX: '{spacing.md}',
          paddingY: '{spacing.sm}',
          typography: '{typography.body-md}',
        },
      },
      examples: [{ label: 'Email field', props: { label: 'Email', placeholder: 'you@example.com' } }],
    },
  },

  prose: {
    overview:
      'Clean Professional favors clarity over decoration: generous whitespace, high-contrast neutrals, and a single confident accent for action.',
    colors:
      'A high-contrast neutral foundation with a single blue accent reserved for primary action and focus.',
    typography: 'Inter across the board; weight and size carry hierarchy, not color.',
    layout: 'A 12-column grid on a strict 8px spacing rhythm; content caps at 1200px.',
    elevation: 'Depth comes from subtle, tight shadows on raised surfaces rather than heavy drop shadows.',
    shapes: 'Soft 8px corners on interactive elements; pills only for badges and avatars.',
    dosDonts: [
      'Do reserve the primary color for the single most important action per screen.',
      'Do maintain WCAG AA contrast (4.5:1 for body text).',
      "Don't mix more than two font weights in one view.",
      "Don't hard-code hex values — reference tokens.",
    ],
  },

  darkMode: { enabled: false, colors: {} },

  export: defaultExportConfig,
}
