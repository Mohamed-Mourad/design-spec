export type ColorValue = `#${string}`
export type DimensionValue = string
export type TokenRef = `{${string}}`

export interface TypographyToken {
  fontFamily: string
  fontSize: DimensionValue
  fontWeight: number
  lineHeight: DimensionValue | number
  letterSpacing?: DimensionValue
  fontFeature?: string
  fontVariation?: string
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize'
}

export interface ComponentTokenGroup {
  backgroundColor?: ColorValue | TokenRef
  textColor?: ColorValue | TokenRef
  typography?: TokenRef
  rounded?: DimensionValue | TokenRef
  padding?: DimensionValue | TokenRef
  paddingX?: DimensionValue | TokenRef
  paddingY?: DimensionValue | TokenRef
  borderColor?: ColorValue | TokenRef
  borderWidth?: DimensionValue | TokenRef
  shadow?: string | TokenRef
  size?: DimensionValue
  height?: DimensionValue
  width?: DimensionValue
  [key: string]: unknown
}

export interface PropDefinition {
  type: 'string' | 'boolean' | 'number' | 'enum' | 'slot'
  values?: string[]
  default?: unknown
  required?: boolean
  description?: string
}

export interface ComponentExample {
  label: string
  props: Record<string, unknown>
  code?: {
    react?: string
    vue?: string
    flutter?: string
  }
}

export interface ComponentBlueprint {
  name: string
  description: string
  category: 'action' | 'form' | 'feedback' | 'navigation' | 'layout' | 'data'
  variants: string[]
  sizes: string[]
  states: string[]
  anatomy: string[]
  props: Record<string, PropDefinition>
  tokens: Record<string, ComponentTokenGroup>
  examples: ComponentExample[]
  dosDonts?: {
    dos: string[]
    donts: string[]
  }
}

export interface DesignSystemSchema {
  version: string
  name: string
  description?: string

  overview: {
    brandPersonality: string
    targetAudience: string
    aestheticDirection: string
    moodKeywords: string[]
  }

  colors: Record<string, ColorValue>
  typography: Record<string, TypographyToken>
  spacing: Record<string, DimensionValue | number>
  rounded: Record<string, DimensionValue>
  shadows: Record<string, string>
  borders: {
    width: Record<string, DimensionValue>
    color: Record<string, ColorValue | TokenRef>
  }
  transitions: {
    duration: Record<string, string>
    easing: Record<string, string>
    reducedMotion: boolean
  }
  breakpoints: Record<string, DimensionValue>
  zIndex: Record<string, number>
  opacity: Record<string, number>
  icons: {
    library: string
    size: Record<string, DimensionValue>
  }
  layout: {
    grid: {
      columns: number
      gutter: DimensionValue | TokenRef
      margin: DimensionValue | TokenRef
    }
    container: {
      maxWidth: DimensionValue
      paddingX: DimensionValue | TokenRef
    }
  }

  components: Record<string, ComponentTokenGroup>
  componentBlueprints: Record<string, ComponentBlueprint>

  prose: {
    overview?: string
    colors?: string
    typography?: string
    layout?: string
    elevation?: string
    shapes?: string
    dosDonts?: string[]
  }

  darkMode: {
    enabled: boolean
    colors: Record<string, ColorValue>
  }

  export: {
    frameworks: Array<'react-tailwind' | 'vue-css' | 'flutter'>
    webNamingConvention: 'kebab-case' | 'camelCase' | 'snake_case' | 'SCREAMING_SNAKE'
    cssVariablePrefix: string
    tailwindClassPrefix: string
    flutterNaming: 'prefixed-class' | 'snake_const' | 'raw'
    fontLoading: 'auto' | 'manual'
    fontSource: 'google' | 'bunny' | 'custom'
    fontSourceUrl?: string
  }
}
