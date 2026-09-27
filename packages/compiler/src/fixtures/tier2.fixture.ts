// tier2.fixture.ts — a schema carrying exactly the Tier 2 blueprints, with the
// token names they reference (the web workspace's default palette: surface-*,
// on-surface-*, status-*; xs…2xl spacing; sm/md/lg breakpoints). The compiler's
// own defaultSchema uses a smaller palette, so the golden tests run Tier 2
// against this instead — otherwise refs would dangle and silently drop from the
// Flutter stubs. Excluded from the build (see tsconfig).

import type { DesignSystemSchema } from '../types/schema.js'
import { defaultSchema } from '../defaultSchema.js'
import { tier2Blueprints } from '../blueprints/tier2.js'

const type = (fontSize: string, fontWeight: number, lineHeight: number) => ({
  fontFamily: 'Inter',
  fontSize: fontSize as `${number}px`,
  fontWeight,
  lineHeight,
})

export const tier2Schema: DesignSystemSchema = {
  ...defaultSchema,
  name: 'Tier 2 Fixture',
  colors: {
    primary: '#3B6EF5',
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
    'status-info': '#3B82F6',
    'status-error-surface': '#FEF2F2',
    'status-warning-surface': '#FFFBEB',
    'status-info-surface': '#EFF6FF',
  },
  typography: {
    'display-md': type('40px', 700, 1.1),
    'headline-sm': type('20px', 600, 1.3),
    'body-md': type('16px', 400, 1.5),
    'body-sm': type('14px', 400, 1.5),
    'label-lg': type('16px', 500, 1.25),
    'label-md': type('14px', 500, 1.25),
    'label-sm': type('12px', 500, 1.25),
  },
  spacing: { xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '32px', '2xl': '48px' },
  rounded: { sm: '4px', md: '6px', lg: '10px', xl: '16px', full: '9999px' },
  shadows: {
    sm: { value: ['0 1px 3px rgba(0,0,0,0.10)', '0 1px 2px rgba(0,0,0,0.06)'] },
    xl: { value: ['0 20px 25px -5px rgba(0,0,0,0.10)', '0 8px 10px -6px rgba(0,0,0,0.10)'] },
  },
  breakpoints: { sm: '640px', md: '768px', lg: '1024px' },
  opacity: { disabled: 0.38, muted: 0.6, full: 1 },
  componentBlueprints: tier2Blueprints,
  export: {
    ...defaultSchema.export,
    frameworks: ['react-tailwind', 'react-css', 'vue-tailwind', 'vue-css', 'flutter'],
  },
}
