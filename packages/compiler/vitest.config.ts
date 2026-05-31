import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // Scope coverage to the pure compile/detect/fix/mcp surface the pack gates
      // at ≥90%. Excludes data (defaultSchema), the fs write helper, re-export
      // barrel, type-only files, and test fixtures.
      include: [
        'src/designMd.ts',
        'src/skillMd.ts',
        'src/tailwind.ts',
        'src/vue.ts',
        'src/cssVars.ts',
        'src/compile.ts',
        'src/detect.ts',
        'src/fix.ts',
        'src/colorMatch.ts',
        'src/scaleMatch.ts',
        'src/tokenResolver.ts',
        'src/yaml.ts',
        'src/resolveResponsive.ts',
        'src/jsonSchema.ts',
        'src/mcp/route.ts',
        'src/components/shared.ts',
        'src/components/react.ts',
        'src/components/vue.ts',
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        statements: 90,
        branches: 85,
      },
    },
  },
})
