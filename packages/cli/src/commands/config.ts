// commands/config.ts — view/edit the project's ExportConfig (Layer 1).
//
// Three modes:
//   design-spec config              interactive survey (reads current as defaults)
//   design-spec config --list       print current export config
//   design-spec config set <k> <v>  set one key non-interactively
//
// Non-TTY (piped / CI) auto-skips the survey and keeps current values unless
// flags are given — so it never hangs waiting for input. After any change the
// project recompiles.

import type { Command } from 'commander'
import { action } from '../run.js'
import { loadSchema, saveSchema } from '../project.js'
import { emit } from '../emit.js'
import * as ui from '../ui.js'
import type { DesignSystemSchema, ExportConfig } from '@design-spec/compiler'

const NAMING: ExportConfig['webNamingConvention'][] = ['kebab-case', 'camelCase', 'snake_case', 'SCREAMING_SNAKE']
const FRAMEWORKS: ExportConfig['frameworks'] = ['react-tailwind', 'vue-css', 'flutter']
const FONT_LOADING: ExportConfig['fontLoading'][] = ['auto', 'manual']

interface ConfigFlags {
  yes?: boolean
  list?: boolean
  frameworks?: string
  naming?: string
  prefix?: string
  fontLoading?: string
}

function applyFlags(cfg: ExportConfig, flags: ConfigFlags): ExportConfig {
  const next = { ...cfg }
  if (flags.frameworks) {
    const fws = flags.frameworks.split(',').map((s) => s.trim()).filter(Boolean) as ExportConfig['frameworks']
    if (fws.length) next.frameworks = fws
  }
  if (flags.naming && (NAMING as string[]).includes(flags.naming)) next.webNamingConvention = flags.naming as ExportConfig['webNamingConvention']
  if (flags.prefix !== undefined) next.cssVariablePrefix = flags.prefix
  if (flags.fontLoading && (FONT_LOADING as string[]).includes(flags.fontLoading)) next.fontLoading = flags.fontLoading as ExportConfig['fontLoading']
  return next
}

async function survey(cfg: ExportConfig): Promise<ExportConfig> {
  const { checkbox, select, input } = await import('@inquirer/prompts')
  const frameworks = (await checkbox({
    message: 'Target frameworks',
    choices: FRAMEWORKS.map((f) => ({ value: f, checked: cfg.frameworks.includes(f) })),
  })) as ExportConfig['frameworks']
  const webNamingConvention = (await select({
    message: 'Token naming convention',
    choices: NAMING.map((n) => ({ value: n })),
    default: cfg.webNamingConvention,
  })) as ExportConfig['webNamingConvention']
  const cssVariablePrefix = await input({ message: 'CSS variable prefix (blank for none)', default: cfg.cssVariablePrefix })
  const fontLoading = (await select({
    message: 'Font loading',
    choices: FONT_LOADING.map((f) => ({ value: f })),
    default: cfg.fontLoading,
  })) as ExportConfig['fontLoading']
  return { ...cfg, frameworks: frameworks.length ? frameworks : cfg.frameworks, webNamingConvention, cssVariablePrefix, fontLoading }
}

async function persist(schema: DesignSystemSchema, nextExport: ExportConfig, path: string, root: string): Promise<void> {
  const updated = { ...schema, export: nextExport }
  await saveSchema(path, updated)
  await emit(updated, root)
}

export function registerConfig(program: Command): void {
  const cmd = program
    .command('config')
    .description('view or edit the project export config (frameworks, naming, prefixes)')
    .option('--list', 'print the current export config', false)
    .option('-y, --yes', 'accept current/flag values without prompting', false)
    .option('--frameworks <list>', 'comma-separated: react-tailwind,vue-css,flutter')
    .option('--naming <convention>', `one of: ${NAMING.join(', ')}`)
    .option('--prefix <prefix>', 'CSS variable prefix')
    .option('--font-loading <mode>', 'auto | manual')
    .addHelpText('after', '\nExamples:\n  $ design-spec config\n  $ design-spec config --list\n  $ design-spec config set cssVariablePrefix ds-')
    .action(
      action(async (flags: ConfigFlags) => {
        const cwd = process.cwd()
        const { schema, path, root } = await loadSchema(cwd)
        const current = schema.export

        if (flags.list) {
          ui.json({ ok: true, export: current })
          ui.table(
            ['Key', 'Value'],
            [
              ['frameworks', current.frameworks.join(', ')],
              ['webNamingConvention', current.webNamingConvention],
              ['cssVariablePrefix', current.cssVariablePrefix || '(none)'],
              ['tailwindClassPrefix', current.tailwindClassPrefix || '(none)'],
              ['fontLoading', current.fontLoading],
            ],
          )
          return
        }

        const hasFlagOverrides = Boolean(flags.frameworks || flags.naming || flags.prefix !== undefined || flags.fontLoading)
        const interactive = Boolean(process.stdout.isTTY) && !flags.yes && !hasFlagOverrides && !ui.uiMode().json

        const next = interactive ? await survey(current) : applyFlags(current, flags)
        await persist(schema, next, path, root)

        ui.json({ ok: true, export: next })
        ui.success('Updated export config and recompiled output.')
      }),
    )

  cmd
    .command('set <key> <value>')
    .description('set a single export config key')
    .action(
      action(async (key: string, value: string) => {
        const cwd = process.cwd()
        const { schema, path, root } = await loadSchema(cwd)
        const next: ExportConfig = { ...schema.export }
        if (key === 'frameworks') next.frameworks = value.split(',').map((s) => s.trim()) as ExportConfig['frameworks']
        else (next as unknown as Record<string, unknown>)[key] = value
        await persist(schema, next, path, root)
        ui.json({ ok: true, export: next })
        ui.success(`Set ${key} = ${value} and recompiled.`)
      }),
    )
}
