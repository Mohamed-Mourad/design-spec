// responsive.fixture.ts — a schema whose Button blueprint declares a responsive
// cascade, used to exercise the resolver, the component compilers, and the
// DESIGN.md responsive tables. Excluded from the build (see tsconfig).

import type { DesignSystemSchema } from '../types/schema.js'
import { minimalSchema } from './minimal.fixture.js'

/** minimalSchema + a Button that grows its padding at tablet/desktop. */
export const responsiveSchema: DesignSystemSchema = {
  ...minimalSchema,
  name: 'Responsive Fixture',
  componentBlueprints: {
    ...minimalSchema.componentBlueprints,
    Button: {
      ...minimalSchema.componentBlueprints.Button,
      responsive: {
        // Declared out of width order on purpose — the resolver must sort them.
        desktop: {
          tokens: { paddingX: '{spacing.xl}', paddingY: '{spacing.md}' },
          layout: 'wider hit target',
        },
        tablet: {
          tokens: { paddingX: '{spacing.lg}' },
          layout: 'comfortable padding',
        },
      },
    },
  },
}

/** A cascade with an undefined breakpoint name and a dangling ref — for validation. */
export const invalidResponsiveSchema: DesignSystemSchema = {
  ...minimalSchema,
  componentBlueprints: {
    Button: {
      ...minimalSchema.componentBlueprints.Button,
      responsive: {
        ultrawide: { tokens: { paddingX: '{spacing.nope}' } },
      },
    },
  },
}
