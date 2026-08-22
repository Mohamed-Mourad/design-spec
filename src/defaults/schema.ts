import type { DesignSystemSchema } from '@/types/schema'
import { tier1Blueprints } from '@/defaults/blueprints'

export const defaultSchema: DesignSystemSchema = {
  version: 'alpha',
  name: 'My Design System',
  description: 'A clean, modern design system for your next project.',

  overview: {
    brandPersonality: 'Professional, clean, and approachable.',
    targetAudience: 'Developers and product teams building modern web applications.',
    aestheticDirection: 'Minimal and functional with a single blue accent. Generous whitespace, clear hierarchy.',
    moodKeywords: ['clean', 'professional', 'modern', 'trustworthy'],
  },

  colors: {
    primary: '#3B6EF5',
    'primary-dim': '#2A55D4',
    'primary-glow': '#5C8BFF',
    secondary: '#64748B',
    neutral: '#94A3B8',

    'surface-page': '#F8FAFC',
    'surface-default': '#FFFFFF',
    'surface-raised': '#F1F5F9',
    'surface-overlay': '#E2E8F0',
    'surface-sunken': '#F0F4F8',
    'surface-border': '#E2E8F0',
    'surface-border-subtle': '#F1F5F9',

    'on-surface': '#0F172A',
    'on-surface-muted': '#475569',
    'on-surface-subtle': '#94A3B8',
    'on-primary': '#FFFFFF',

    'status-error': '#EF4444',
    'status-warning': '#F59E0B',
    'status-success': '#10B981',
    'status-info': '#3B82F6',

    // Soft status backgrounds — tinted surfaces for alerts/badges.
    'status-error-surface': '#FEF2F2',
    'status-warning-surface': '#FFFBEB',
    'status-success-surface': '#ECFDF5',
    'status-info-surface': '#EFF6FF',

    'interactive-focus-ring': '#3B6EF5',
  },

  typography: {
    'display-lg': {
      fontFamily: 'Inter',
      fontSize: '56px',
      fontWeight: 700,
      lineHeight: 1.05,
      letterSpacing: '-0.02em',
    },
    'display-md': {
      fontFamily: 'Inter',
      fontSize: '40px',
      fontWeight: 700,
      lineHeight: 1.1,
      letterSpacing: '-0.015em',
    },
    'headline-lg': {
      fontFamily: 'Inter',
      fontSize: '32px',
      fontWeight: 600,
      lineHeight: 1.2,
      letterSpacing: '-0.01em',
    },
    'headline-md': {
      fontFamily: 'Inter',
      fontSize: '24px',
      fontWeight: 600,
      lineHeight: 1.25,
      letterSpacing: '-0.005em',
    },
    'headline-sm': {
      fontFamily: 'Inter',
      fontSize: '18px',
      fontWeight: 600,
      lineHeight: 1.3,
    },
    'body-lg': {
      fontFamily: 'Inter',
      fontSize: '16px',
      fontWeight: 400,
      lineHeight: 1.65,
    },
    'body-md': {
      fontFamily: 'Inter',
      fontSize: '14px',
      fontWeight: 400,
      lineHeight: 1.55,
    },
    'body-sm': {
      fontFamily: 'Inter',
      fontSize: '13px',
      fontWeight: 400,
      lineHeight: 1.5,
    },
    'label-lg': {
      fontFamily: 'Inter',
      fontSize: '13px',
      fontWeight: 500,
      lineHeight: 1,
    },
    'label-md': {
      fontFamily: 'Inter',
      fontSize: '12px',
      fontWeight: 500,
      lineHeight: 1,
      letterSpacing: '0.02em',
    },
    'label-sm': {
      fontFamily: 'Inter',
      fontSize: '11px',
      fontWeight: 600,
      lineHeight: 1,
      letterSpacing: '0.06em',
    },
    overline: {
      fontFamily: 'Inter',
      fontSize: '11px',
      fontWeight: 600,
      lineHeight: 1,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
    },
    'code-md': {
      fontFamily: 'JetBrains Mono',
      fontSize: '13px',
      fontWeight: 400,
      lineHeight: 1.65,
    },
    'code-sm': {
      fontFamily: 'JetBrains Mono',
      fontSize: '12px',
      fontWeight: 400,
      lineHeight: 1.5,
    },
  },

  spacing: {
    base: '4px',
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    '2xl': '48px',
    '3xl': '64px',
    '4xl': '96px',
    gutter: '24px',
    margin: '32px',
  },

  rounded: {
    none: '0px',
    xs: '2px',
    sm: '4px',
    md: '6px',
    lg: '10px',
    xl: '16px',
    '2xl': '24px',
    full: '9999px',
  },

  shadows: {
    none: { value: 'none' },
    xs: { value: '0 1px 2px rgba(0,0,0,0.05)' },
    sm: { value: ['0 1px 3px rgba(0,0,0,0.10)', '0 1px 2px rgba(0,0,0,0.06)'] },
    md: { value: ['0 4px 6px -1px rgba(0,0,0,0.10)', '0 2px 4px -2px rgba(0,0,0,0.10)'] },
    lg: { value: ['0 10px 15px -3px rgba(0,0,0,0.10)', '0 4px 6px -4px rgba(0,0,0,0.10)'] },
    xl: { value: ['0 20px 25px -5px rgba(0,0,0,0.10)', '0 8px 10px -6px rgba(0,0,0,0.10)'] },
    inner: { value: 'inset 0 2px 4px rgba(0,0,0,0.06)', inset: true },
  },

  borders: {
    width: {
      none: '0px',
      sm: '1px',
      md: '2px',
      lg: '4px',
    },
    color: {
      default: '{colors.surface-border}',
      strong: '{colors.on-surface-muted}',
      focus: '{colors.interactive-focus-ring}',
      error: '{colors.status-error}',
    },
  },

  transitions: {
    duration: {
      instant: '0ms',
      fast: '100ms',
      normal: '200ms',
      slow: '350ms',
      xslow: '500ms',
    },
    easing: {
      linear: 'linear',
      'ease-out': 'cubic-bezier(0, 0, 0.2, 1)',
      'ease-in': 'cubic-bezier(0.4, 0, 1, 1)',
      'ease-in-out': 'cubic-bezier(0.4, 0, 0.2, 1)',
      spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    },
    reducedMotion: false,
  },

  breakpoints: {
    xs: '320px',
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },

  zIndex: {
    below: -1,
    base: 0,
    raised: 10,
    dropdown: 100,
    sticky: 200,
    overlay: 300,
    modal: 400,
    toast: 500,
    tooltip: 600,
  },

  opacity: {
    0: 0,
    disabled: 0.38,
    muted: 0.6,
    secondary: 0.75,
    hover: 0.88,
    full: 1,
  },

  icons: {
    library: 'lucide',
    size: {
      xs: '12px',
      sm: '16px',
      md: '20px',
      lg: '24px',
      xl: '32px',
      '2xl': '48px',
    },
  },

  layout: {
    grid: {
      columns: 12,
      gutter: '{spacing.md}',
      margin: '{spacing.lg}',
    },
    container: {
      maxWidth: '1280px',
      paddingX: '{spacing.lg}',
    },
  },

  components: {
    'button-primary': {
      backgroundColor: '{colors.primary}',
      textColor: '{colors.on-primary}',
      typography: '{typography.label-lg}',
      rounded: '{rounded.md}',
      paddingX: '16px',
      paddingY: '8px',
    },
    'button-primary-hover': {
      backgroundColor: '{colors.primary-glow}',
    },
    'button-primary-active': {
      backgroundColor: '{colors.primary-dim}',
    },
    'button-secondary': {
      backgroundColor: '{colors.surface-raised}',
      textColor: '{colors.on-surface}',
      borderColor: '{colors.surface-border}',
      borderWidth: '1px',
      typography: '{typography.label-lg}',
      rounded: '{rounded.md}',
      paddingX: '16px',
      paddingY: '8px',
    },
    'button-ghost': {
      textColor: '{colors.on-surface-muted}',
      typography: '{typography.label-lg}',
      rounded: '{rounded.md}',
      paddingX: '12px',
      paddingY: '8px',
    },
    input: {
      backgroundColor: '{colors.surface-sunken}',
      textColor: '{colors.on-surface}',
      borderColor: '{colors.surface-border}',
      borderWidth: '1px',
      rounded: '{rounded.md}',
      padding: '10px',
      typography: '{typography.body-md}',
    },
    'input-focus': {
      borderColor: '{colors.interactive-focus-ring}',
    },
    'input-error': {
      borderColor: '{colors.status-error}',
    },
    card: {
      backgroundColor: '{colors.surface-raised}',
      rounded: '{rounded.lg}',
      padding: '{spacing.lg}',
      shadow: '{shadows.sm}',
      borderColor: '{colors.surface-border-subtle}',
      borderWidth: '1px',
    },
    modal: {
      backgroundColor: '{colors.surface-overlay}',
      rounded: '{rounded.xl}',
      padding: '{spacing.xl}',
      shadow: '{shadows.xl}',
    },
    badge: {
      backgroundColor: '{colors.surface-overlay}',
      textColor: '{colors.on-surface-muted}',
      rounded: '{rounded.full}',
      paddingX: '8px',
      paddingY: '3px',
      typography: '{typography.label-sm}',
    },
    tooltip: {
      backgroundColor: '{colors.surface-overlay}',
      textColor: '{colors.on-surface}',
      rounded: '{rounded.sm}',
      padding: '8px',
      shadow: '{shadows.lg}',
    },
  },

  componentBlueprints: tier1Blueprints,

  prose: {
    overview: '',
    colors: '',
    typography: '',
    layout: '',
    elevation: '',
    shapes: '',
    dosDonts: [],
  },

  darkMode: {
    enabled: true,
    // Color overrides applied in dark mode; keys not listed inherit the light value.
    colors: {
      'surface-page': '#0F1115',
      'surface-default': '#161A21',
      'surface-raised': '#1E232C',
      'surface-overlay': '#272D38',
      'surface-sunken': '#0B0D11',
      'surface-border': '#2C333F',
      'surface-border-subtle': '#1E232C',
      'on-surface': '#E6E9EF',
      'on-surface-muted': '#9AA3B2',
      'on-surface-subtle': '#5C6370',
      // Darker, desaturated status tints that read on a dark surface.
      'status-error-surface': '#2A1719',
      'status-warning-surface': '#2A2113',
      'status-success-surface': '#15251D',
      'status-info-surface': '#16263A',
    },
  },

  export: {
    frameworks: ['react-tailwind'],
    webNamingConvention: 'kebab-case',
    cssVariablePrefix: '',
    tailwindClassPrefix: '',
    flutterNaming: 'prefixed-class',
    fontLoading: 'auto',
    fontSource: 'google',
  },
}
