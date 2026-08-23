// __fixtures__/repos.ts — representative repositories the retrofit engine has
// to survive. Each is the exact file set a harvest would return.
//
// `complexTailwind` is the one that matters most: its config uses every
// construct the static reader must refuse to evaluate (a preset import, an
// object spread, `process.env`, a plugin call, a computed key, an interpolated
// template) while still declaring statically safe siblings. Its compiled bundle
// carries the post-build truth the Smart Fallback recovers.

import type { ImportFile } from '../types.js'

const pkg = (name: string, deps: Record<string, string>): ImportFile => ({
  path: 'package.json',
  kind: 'package_json',
  content: JSON.stringify({ name, private: true, dependencies: deps }, null, 2),
})

/** A plain, fully statically readable React + Tailwind project. */
export const simpleTailwind: ImportFile[] = [
  pkg('acme-storefront', { react: '^18.2.0', 'react-dom': '^18.2.0', tailwindcss: '^3.4.1' }),
  {
    path: 'tailwind.config.js',
    kind: 'tailwind_config',
    content: `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#C8813D', 500: '#C8813D', 600: '#A96A2E' },
        surface: '#FFFFFF',
        ink: '#1F1D1A',
        danger: '#DC2626',
      },
      spacing: { xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '40px' },
      borderRadius: { sm: '4px', md: '8px', lg: '12px' },
      screens: { sm: '640px', md: '768px', lg: '1024px' },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'], display: ['DM Serif Display', 'serif'] },
      boxShadow: { sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)' },
    },
  },
  plugins: [],
}
`,
  },
]

/**
 * A TypeScript config that cannot be statically evaluated in full: it spreads an
 * imported preset, reads `process.env`, calls `definePreset`, uses a computed
 * key and an interpolated template. Every literal sibling must still survive.
 */
export const complexTailwind: ImportFile[] = [
  pkg('nebula-app', { next: '^14.1.0', react: '^18.2.0', tailwindcss: '^3.4.1' }),
  {
    path: 'tailwind.config.ts',
    kind: 'tailwind_config',
    content: `import type { Config } from 'tailwindcss'
import basePreset from '@nebula/tailwind-preset'
import { definePreset } from './lib/preset'
import plugin from 'tailwindcss/plugin'

const BRAND = process.env.NEXT_PUBLIC_BRAND ?? 'nebula'
const accentKey = \`accent-\${BRAND}\`

const config: Config = {
  darkMode: 'class',
  presets: [basePreset],
  content: ['./app/**/*.tsx'],
  theme: {
    extend: {
      ...basePreset.theme.extend,
      colors: {
        ...basePreset.theme.colors,
        [accentKey]: '#7C3AED',
        canvas: '#0B0B0F',
        env: process.env.BRAND_COLOR,
        // Statically safe siblings — these must survive the unparseable layers.
        primary: '#4F46E5',
        muted: '#9CA3AF',
      },
      spacing: definePreset({ base: 4 }),
      borderRadius: { lg: '0.75rem' },
      fontFamily: { sans: ['Satoshi', 'sans-serif'] },
    },
  },
  plugins: [plugin(({ addUtilities }) => addUtilities({}))],
}

export default config
`,
  },
  {
    path: 'app/globals.css',
    kind: 'source_css',
    content: `@tailwind base;
@tailwind components;
@tailwind utilities;

/* Only one token is declared by hand; the rest live in the unparseable preset. */
:root {
  --color-canvas: #0B0B0F;
}
`,
  },
  {
    path: '.next/static/css/8f2a1c.css',
    kind: 'compiled_css',
    content:
      ':root,:host{--color-primary:#4F46E5;--color-secondary:#64748B;--color-surface:#0B0B0F;' +
      '--color-on-surface:#F4F4F5;--color-muted:#9CA3AF;--color-border:#27272A;' +
      '--color-error:#F43F5E;--color-success:#22C55E;--color-accent-nebula:#7C3AED;' +
      '--spacing-xs:4px;--spacing-sm:8px;--spacing-md:16px;--spacing-lg:24px;--spacing-xl:40px;' +
      '--radius-sm:4px;--radius-md:8px;--radius-lg:12px;' +
      '--shadow-sm:0 1px 2px 0 rgb(0 0 0 / 0.4);' +
      '--font-sans:Satoshi;--text-sm:14px;--text-base:16px;--text-lg:18px;--text-2xl:24px;--text-4xl:36px;' +
      '--breakpoint-md:768px}' +
      '@media (prefers-color-scheme: dark){:root{--color-surface:#050507;--color-on-surface:#FAFAFA}}' +
      '.btn{--tw-ring-offset-width:0px;color:var(--color-on-surface)}',
  },
]

/** A shadcn/ui-shaped repo: no Tailwind theme, raw HSL triplets in CSS. */
export const shadcnCssVars: ImportFile[] = [
  pkg('ledger-ui', { react: '^18.2.0', tailwindcss: '^3.4.1' }),
  {
    path: 'src/index.css',
    kind: 'source_css',
    content: `@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    --secondary: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --border: 214.3 31.8% 91.4%;
    --destructive: 0 84.2% 60.2%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
  }
}
`,
  },
]

/** A Tailwind v4 repo: no config file at all, the theme lives in CSS. */
export const tailwindV4: ImportFile[] = [
  pkg('orbit-web', { vue: '^3.5.13', tailwindcss: '^4.1.7' }),
  {
    path: 'src/styles/main.css',
    kind: 'source_css',
    content: `@import "tailwindcss";

@theme {
  --color-primary: oklch(0.62 0.19 259.8);
  --color-surface: oklch(1 0 0);
  --color-on-surface: oklch(0.21 0.03 264.7);
  --spacing-md: 1rem;
  --radius-md: 0.5rem;
  --font-sans: "Geist", sans-serif;
}
`,
  },
]

/** A Flutter app — Dart theme colors, no web config at all. */
export const flutterApp: ImportFile[] = [
  { path: 'pubspec.yaml', kind: 'pubspec', content: 'name: harbor_app\ndescription: A harbor app.\n' },
  {
    path: 'lib/theme/app_colors.dart',
    kind: 'dart_theme',
    content: `import 'package:flutter/material.dart';

class AppColors {
  static const Color primary = Color(0xFF2563EB);
  static const Color surfaceRaised = Color(0xFFF8FAFC);
  static const Color _onSurface = Color(0xFF0F172A);
}
`,
  },
]

/** Nothing recognisable — the import must still produce a usable schema. */
export const emptyRepo: ImportFile[] = [
  { path: 'README.md', kind: 'source_css', content: '# just a readme\n' },
]
