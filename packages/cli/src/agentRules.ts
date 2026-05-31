// agentRules.ts — inject an isolated, re-writable block into agent rule files.
//
// `init` tells AI agents to treat design-spec.schema.json as the token source of
// truth and not to hand-edit generated output. The instruction is wrapped in
// START/END markers and injected into existing rule files WITHOUT clobbering a
// developer's own rules. Re-running init rewrites only the marker span.

import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { stageWrite } from './plan.js'

export const BLOCK_START = '# ─── DESIGN-SPEC START ───'
export const BLOCK_END = '# ─── DESIGN-SPEC END ───'

/** The managed instruction block (between the markers). */
export function ruleBlockBody(): string {
  return [
    'design-spec.schema.json is the design-token source of truth — do NOT auto-edit it casually;',
    'editing it triggers a full recompile. Generated output (DESIGN.md, SKILL.md, tailwind.config.js,',
    'tokens.css) is derived — never hand-edit it; change the schema and run `design-spec compile`.',
    'When writing UI, reference design tokens (never inline hex / `text-[#…]` / `Color(0xFF…)`).',
    'Run `design-spec serve` for scoped token context over MCP.',
  ].join('\n')
}

/**
 * Insert or replace the managed block in `content`. Everything outside the
 * markers is preserved byte-for-byte. A file with no markers gets the block
 * appended (developer rules above, ours below). Pure.
 */
export function upsertBlock(content: string, block: string): string {
  const managed = `${BLOCK_START}\n${block}\n${BLOCK_END}`
  const startIdx = content.indexOf(BLOCK_START)
  const endIdx = content.indexOf(BLOCK_END)

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const before = content.slice(0, startIdx)
    const after = content.slice(endIdx + BLOCK_END.length)
    return `${before}${managed}${after}`
  }

  if (content.trim() === '') return managed + '\n'
  const sep = content.endsWith('\n') ? '\n' : '\n\n'
  return `${content}${sep}${managed}\n`
}

const RULE_FILES = ['.cursorrules', '.windsurfrules', 'CLAUDE.md', 'AGENTS.md']

export interface RuleInjection {
  file: string
  action: 'created' | 'updated'
}

/**
 * Inject the managed block into every agent rule file that already exists, plus
 * always ensure AGENTS.md (the open convention) carries it. Returns what
 * changed. Never touches files outside the marker span.
 */
export async function injectAgentRules(root: string): Promise<RuleInjection[]> {
  const block = ruleBlockBody()
  const results: RuleInjection[] = []

  // Always seed AGENTS.md; only touch the others if the developer already uses them.
  const targets = new Set<string>(['AGENTS.md'])
  for (const f of RULE_FILES) if (existsSync(join(root, f))) targets.add(f)

  for (const rel of targets) {
    const path = join(root, rel)
    const existed = existsSync(path)
    const current = existed ? await readFile(path, 'utf8') : ''
    const next = upsertBlock(current, block)
    if (next !== current) {
      await stageWrite(path, next)
      results.push({ file: rel, action: existed ? 'updated' : 'created' })
    }
  }
  return results
}
