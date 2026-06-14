// Re-export the schema contract from @design-spec/compiler — the single source
// of truth shared by every Design Spec repo. The web app must never fork these
// shapes; see the `evolving-schema-contract` skill. Import paths stay
// `@/types/schema` so existing consumers don't change.

export type {
  ColorValue,
  DimensionValue,
  TokenRef,
  ShadowValue,
  TypographyToken,
  ShadowToken,
  ComponentTokenGroup,
  ResponsiveBreakpoint,
  PropDefinition,
  ComponentExample,
  ComponentBlueprint,
  ExportConfig,
  WebPresentationConfig,
  BentoLayoutConfig,
  BentoCellConfig,
  DesignSystemSchema,
} from '@design-spec/compiler'
