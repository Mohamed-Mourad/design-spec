// globalConfig.ts — machine-level config at ~/.config/design-spec/config.json.
//
// Holds cross-project user defaults and the dashboard API key. Distinct from the
// per-project, git-tracked design-spec.schema.json. Located via env-paths so it
// lands in the correct OS-specific config dir.

import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import envPaths from 'env-paths'
import { atomicWrite } from '@design-spec/compiler/node'
import type { ExportConfig } from '@design-spec/compiler'

export interface GlobalConfig {
  /** API key for dashboard sync/push — remembered from `--key`. Never printed. */
  apiKey?: string
  /** Dashboard API origin override (default https://api.design-spec.ai). */
  apiUrl?: string
  /** Machine-wide defaults applied to `init` when no project signal exists. */
  defaults?: Partial<ExportConfig>
}

const paths = envPaths('design-spec', { suffix: '' })

/** `DESIGN_SPEC_CONFIG_DIR` relocates it (CI runners, tests). */
export function globalConfigPath(): string {
  return join(process.env.DESIGN_SPEC_CONFIG_DIR || paths.config, 'config.json')
}

export async function loadGlobalConfig(): Promise<GlobalConfig> {
  const path = globalConfigPath()
  if (!existsSync(path)) return {}
  try {
    return JSON.parse(await readFile(path, 'utf8')) as GlobalConfig
  } catch {
    return {}
  }
}

export async function saveGlobalConfig(config: GlobalConfig): Promise<string> {
  const path = globalConfigPath()
  await atomicWrite(path, JSON.stringify(config, null, 2) + '\n')
  return path
}
