export type Framework = 'react-tailwind' | 'vue-css' | 'flutter'

export interface FileOutput {
  filename: string
  content: string
  language: 'markdown' | 'javascript' | 'typescript' | 'css' | 'dart' | 'json'
  path?: string
}

export interface CompilerOptions {
  frameworks: Framework[]
  cssVariablePrefix: string
  webNamingConvention: 'kebab-case' | 'camelCase' | 'snake_case' | 'SCREAMING_SNAKE'
  flutterNaming: 'prefixed-class' | 'snake_const' | 'raw'
  fontLoading: 'auto' | 'manual'
  fontSource: 'google' | 'bunny' | 'custom'
  fontSourceUrl?: string
}
