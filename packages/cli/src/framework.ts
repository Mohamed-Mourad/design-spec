// framework.ts — detect a project's UI framework from its manifest + file tree.
//
// A thin filesystem adapter over the compiler's `detectFramework`, which is the
// single source of truth for what "this is a react-tailwind project" means. The
// cloud retrofit calls the same function with files harvested over the GitHub
// Contents API, so the CLI and the web never disagree about a repo.

import type { FrameworkStack } from '@design-spec/compiler'
import { detectFramework as detect } from '@design-spec/compiler'
import { collectImportFiles } from './scan.js'

// Re-exported under the local name the CLI already uses; the compiler is the
// single source of truth for the stack union.
export type Framework = FrameworkStack

export interface Detection {
  frameworks: Framework[]
  /** Human-readable signals that drove the detection (shown in --verbose/init). */
  signals: string[]
  hasTailwind: boolean
  /** Project name from package.json / pubspec.yaml, when present. */
  projectName?: string
}

/** Detect the framework(s) in `root`. Falls back to react-tailwind if unknown. */
export async function detectFramework(root: string): Promise<Detection> {
  const { files, paths } = await collectImportFiles(root)
  return detect(files, paths)
}
