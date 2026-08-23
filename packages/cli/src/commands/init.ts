// commands/init.ts — the flagship first-run: detect → scan → synthesize → compile.
//
// Branded banner → animated task list (detect, scan, synthesize, compile,
// agent rules) → boxed summary of what was created and what to do next. Writes
// design-spec.schema.json, DESIGN.md, SKILL.md, framework outputs, and injects
// the managed block into agent rule files (never clobbering developer rules).
//
// Extraction runs through `@design-spec/compiler`'s shared engine — the same one
// the cloud retrofit uses — plus the one thing only the CLI may do: evaluate the
// project's own Tailwind config locally for byte-exact values.
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
import type { Framework } from '../framework.js'
import { collectImportFiles } from '../scan.js'
import { scanTailwind } from '../scanners/tailwind.js'
import { synthesizeSchema } from '../synthesize.js'
import { emit } from '../emit.js'
import { injectAgentRules, type RuleInjection } from '../agentRules.js'
import { splashContext } from '../branding.js'
import type {
  DesignSystemSchema,
  ExtractionSummary,
  ImportFile,
  ResolvedTokens,
} from '@design-spec/compiler'
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
  files: ImportFile[]
  paths: string[]
  resolved: ResolvedTokens
  frameworks: Framework[]
  signals: string[]
  summary: ExtractionSummary
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

function requestedFrameworks(flags: InitFlags): Framework[] | undefined {
  if (!flags.frameworks) return undefined
  const list = flags.frameworks.split(',').map((s) => s.trim()).filter(Boolean) as Framework[]
  return list.length ? list : undefined
}

/** "12 extracted · 5 inferred · 40 defaulted" — what to verify, at a glance. */
function summaryLine(s: ExtractionSummary): string {
  return `Tokens: ${s.extracted} extracted · ${s.inferred} inferred · ${s.defaulted} from defaults`
}

export function registerInit(program: Command): void {
  program
    .command('init')
    .description('detect your framework, synthesize design-spec.schema.json, and compile outputs')
    .option('-y, --yes', 'non-interactive; accept all defaults', false)
    .option('--force', 'overwrite an existing design-spec.schema.json', false)
    .option('--frameworks <list>', 'comma-separated: react-tailwind,react-css,vue-tailwind,vue-css,flutter')
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

        ui.splash(
          splashContext(root, {
            tip: 'Generating your design system · local-first, no account needed.',
            status: 'Detecting framework, synthesizing tokens, compiling output…',
          }),
        )

        const ctx = await ui.tasks<InitCtx>(
          [
            {
              title: 'Detecting framework',
              task: async (c) => {
                const collected = await collectImportFiles(root)
                c.files = collected.files
                c.paths = collected.paths
              },
            },
            {
              title: 'Scanning existing tokens',
              task: async (c) => {
                // The byte-exact layer: evaluating the project's own config is
                // legal here (the developer's machine), never server-side.
                const tw = await scanTailwind(root)
                c.resolved = {
                  colors: tw.colors,
                  spacing: tw.spacing,
                  rounded: tw.rounded,
                  screens: tw.screens,
                  fontFamily: tw.fontFamily,
                  fontSize: tw.fontSize,
                  shadows: tw.shadows,
                }
                if (tw.skipped) c.signals.push(`tailwind config: ${tw.skipped}`)
              },
            },
            {
              title: 'Synthesizing schema',
              task: async (c) => {
                const result = synthesizeSchema({
                  name: await projectName(root),
                  frameworks: requestedFrameworks(flags),
                  files: c.files,
                  paths: c.paths,
                  resolved: c.resolved,
                  exportOverrides: exportOverrides(flags),
                })
                c.schema = result.schema
                c.frameworks = result.frameworks
                c.summary = result.extraction.summary
                c.signals.push(
                  ...result.extraction.detection.signals,
                  ...result.extraction.signals.map((s) => `${s.source}: ${s.message}`),
                )
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
          {
            root,
            files: [],
            paths: [],
            resolved: {},
            frameworks: [],
            signals: [],
            summary: { extracted: 0, inferred: 0, defaulted: 0 },
            schema: undefined as unknown as DesignSystemSchema,
            written: [],
            rules: [],
          },
        )

        ui.json({
          ok: true,
          name: ctx.schema.name,
          frameworks: ctx.frameworks,
          written: ctx.written,
          rules: ctx.rules,
          tokens: ctx.summary,
          signals: ctx.signals,
        })

        ui.box(ctx.schema.name, [
          `Frameworks: ${ctx.frameworks.join(', ')}`,
          summaryLine(ctx.summary),
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
