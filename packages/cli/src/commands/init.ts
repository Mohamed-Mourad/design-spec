// commands/init.ts — the flagship first-run: detect → synthesize → compile.
//
// Branded banner → animated task list (detect, scan, synthesize, compile,
// agent rules) → boxed summary of what was created and what to do next. Writes
// design-spec.schema.json, DESIGN.md, SKILL.md, framework outputs, and injects
// the managed block into agent rule files (never clobbering developer rules).
//
// --yes runs fully non-interactive (CI-safe). Existing schema is preserved
// unless --force.

import type { Command } from 'commander'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { basename, join, relative } from 'node:path'
import { action } from '../run.js'
import { findSchema, SCHEMA_FILE, saveSchema } from '../project.js'
import { CliError, ExitCode } from '../errors.js'
import { detectFramework, type Framework } from '../framework.js'
import { scanTailwind } from '../scanners/tailwind.js'
import { scanCssFiles } from '../scanners/cssVars.js'
import { scanFlutter } from '../scanners/flutter.js'
import { synthesizeSchema } from '../synthesize.js'
import { emit } from '../emit.js'
import { injectAgentRules, type RuleInjection } from '../agentRules.js'
import type { ColorValue, DesignSystemSchema, DimensionValue } from '@design-spec/compiler'
import { glob } from 'node:fs/promises'
import * as ui from '../ui.js'

interface InitFlags {
  yes?: boolean
  force?: boolean
  frameworks?: string
  naming?: string
  prefix?: string
  fontLoading?: string
}

interface InitCtx {
  root: string
  frameworks: Framework[]
  signals: string[]
  scanned: { colors: Record<string, ColorValue>; spacing: Record<string, DimensionValue>; rounded: Record<string, DimensionValue> }
  schema: DesignSystemSchema
  written: string[]
  rules: RuleInjection[]
}

async function projectName(root: string): Promise<string> {
  const pkgPath = join(root, 'package.json')
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(await readFile(pkgPath, 'utf8')) as { name?: string }
      if (pkg.name) return pkg.name
    } catch {
      /* fall through */
    }
  }
  return basename(root)
}

function exportOverrides(flags: InitFlags): Partial<DesignSystemSchema['export']> {
  const o: Partial<DesignSystemSchema['export']> = {}
  if (flags.naming) o.webNamingConvention = flags.naming as DesignSystemSchema['export']['webNamingConvention']
  if (flags.prefix !== undefined) o.cssVariablePrefix = flags.prefix
  if (flags.fontLoading) o.fontLoading = flags.fontLoading as DesignSystemSchema['export']['fontLoading']
  return o
}

export function registerInit(program: Command): void {
  program
    .command('init')
    .description('detect your framework, synthesize design-spec.schema.json, and compile outputs')
    .option('-y, --yes', 'non-interactive; accept all defaults', false)
    .option('--force', 'overwrite an existing design-spec.schema.json', false)
    .option('--frameworks <list>', 'comma-separated: react-tailwind,vue-css,flutter')
    .option('--naming <convention>', 'token naming convention')
    .option('--prefix <prefix>', 'CSS variable prefix')
    .option('--font-loading <mode>', 'auto | manual')
    .addHelpText('after', '\nExamples:\n  $ design-spec init\n  $ design-spec init --yes\n  $ design-spec init --frameworks vue-css --prefix ds-')
    .action(
      action(async (flags: InitFlags) => {
        const root = process.cwd()
        const existing = findSchema(root)
        if (existing && !flags.force) {
          throw new CliError('design-spec.schema.json already exists.', {
            code: 'E_ALREADY_INIT',
            exitCode: ExitCode.GENERIC,
            hint: 'Use --force to overwrite, or "design-spec config" to edit settings.',
          })
        }

        ui.brandHeader('design-spec', 'Local-first design system engine')

        const ctx = await ui.tasks<InitCtx>(
          [
            {
              title: 'Detecting framework',
              task: async (c) => {
                const det = await detectFramework(root)
                c.frameworks = flags.frameworks
                  ? (flags.frameworks.split(',').map((s) => s.trim()).filter(Boolean) as Framework[])
                  : det.frameworks
                c.signals = det.signals
              },
            },
            {
              title: 'Scanning existing tokens',
              task: async (c) => {
                const tw = await scanTailwind(root)
                const cssFiles: string[] = []
                for await (const f of glob('**/*.{css,scss}', { cwd: root })) {
                  if (!/node_modules|dist|build/.test(f)) cssFiles.push(join(root, f))
                }
                const css = await scanCssFiles(cssFiles.slice(0, 20))
                const flutter = c.frameworks.includes('flutter') ? await scanFlutter(root) : { colors: {} }
                c.scanned = {
                  colors: { ...tw.colors, ...css.colors, ...flutter.colors },
                  spacing: { ...tw.spacing },
                  rounded: { ...tw.rounded },
                }
              },
            },
            {
              title: 'Synthesizing schema',
              task: async (c) => {
                c.schema = synthesizeSchema({
                  name: await projectName(root),
                  frameworks: c.frameworks,
                  scanned: c.scanned,
                  exportOverrides: exportOverrides(flags),
                })
              },
            },
            {
              title: 'Writing schema + compiling output',
              task: async (c) => {
                await saveSchema(join(root, SCHEMA_FILE), c.schema)
                c.written = [SCHEMA_FILE, ...(await emit(c.schema, root))]
              },
            },
            {
              title: 'Wiring up AI agent rules',
              task: async (c) => {
                c.rules = await injectAgentRules(root)
              },
            },
          ],
          { root, frameworks: [], signals: [], scanned: { colors: {}, spacing: {}, rounded: {} }, schema: undefined as unknown as DesignSystemSchema, written: [], rules: [] },
        )

        ui.json({
          ok: true,
          name: ctx.schema.name,
          frameworks: ctx.frameworks,
          written: ctx.written,
          rules: ctx.rules,
          signals: ctx.signals,
        })

        ui.box(ctx.schema.name, [
          `Frameworks: ${ctx.frameworks.join(', ')}`,
          '',
          'Created:',
          ...ctx.written.map((f) => `  • ${relative(root, join(root, f)) || f}`),
          ...ctx.rules.map((r) => `  • ${r.file} (${r.action})`),
          '',
          'Next steps:',
          '  • design-spec watch        recompile on every schema save',
          '  • design-spec serve        feed scoped tokens to your AI agent (MCP)',
          '  • Drop SKILL.md into your agent context.',
        ])
      }),
    )
}
