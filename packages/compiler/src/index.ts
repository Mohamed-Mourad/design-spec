// @design-spec/compiler — package boundary established in Phase 0.9.
//
// This is the published artifact the web app, CLI, CI Drift-Janitor, and the
// closed-source Figma plugin all depend on. Phase 1 extracts the real
// compilers (designMd, skillMd, tailwind, vue), detect/fix, resolveResponsive,
// the mcp/route resolvers, and the shared schema types into this package.
//
// Until then this file exists only to make the package buildable and
// yalc-publishable so the cross-repo linking topology (see DEVELOPMENT.md)
// can be exercised end-to-end before v0.0.1 ships to npm.

export const COMPILER_VERSION = '0.0.1' as const

// Phase 1 fills these in:
// export * from './types/schema'
// export { compileDesignMd } from './designMd'
// export { compileSkillMd } from './skillMd'
// export { detect } from './detect'
// export { fix } from './fix'
// export * from './mcp/route'
