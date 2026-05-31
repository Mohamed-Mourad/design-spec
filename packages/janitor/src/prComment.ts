// prComment.ts — the 🧹 summary comment + the GitHub REST client behind it.
//
// The comment is idempotent: it carries a hidden marker and we update the
// existing comment in place rather than posting a new one every run (no spam).
// The client is an injectable interface so the runner can be driven in tests
// with a fake (no network). The real client never logs the token.

import type { FixResult } from './fix.js'

export const MARKER = '<!-- design-spec-janitor -->'

export interface IssueComment {
  id: number
  body: string
}

export interface GitHubClient {
  listComments(prNumber: number): Promise<IssueComment[]>
  createComment(prNumber: number, body: string): Promise<void>
  updateComment(commentId: number, body: string): Promise<void>
}

/** Build the marked-up summary body. Pure. */
export function buildComment(result: FixResult, leaseFailed: boolean): string {
  const lines: string[] = [MARKER, '## 🧹 Design Spec Janitor', '']

  if (leaseFailed) {
    lines.push(
      '⚠️ The branch moved while the janitor was running (a concurrent push), so the auto-fix was **not** applied this run. Re-run after the branch settles.',
      '',
    )
  }

  if (result.totalFixes > 0) {
    const fileCount = result.changed.length
    lines.push(
      `Replaced **${result.totalFixes}** raw ${result.totalFixes === 1 ? 'value' : 'values'} with design tokens across **${fileCount}** ${fileCount === 1 ? 'file' : 'files'}.`,
      '',
      '| File | Was | Now | Token |',
      '|---|---|---|---|',
    )
    for (const r of result.rows) {
      lines.push(`| \`${r.file}\`:${r.line} | \`${r.was}\` | \`${r.now}\` | \`${r.token}\` |`)
    }
    lines.push('')
  } else if (!leaseFailed) {
    lines.push('No auto-fixable token drift found. ✅', '')
  }

  if (result.advisory.length > 0) {
    lines.push(
      `### Advisory — ${result.advisory.length} value(s) need a human`,
      'These had no token within tolerance, so they were left untouched (non-blocking):',
      '',
    )
    for (const d of result.advisory) {
      lines.push(`- \`${d.file}\`:${d.line} — \`${d.found}\` (no matching token)`)
    }
    lines.push('')
  }

  lines.push('<sub>Remediation, not obstruction — this check never blocks your merge.</sub>')
  return lines.join('\n')
}

/** Create or update the single janitor comment on the PR (dedupe by marker). */
export async function upsertComment(client: GitHubClient, prNumber: number, body: string): Promise<void> {
  const comments = await client.listComments(prNumber)
  const existing = comments.find((c) => c.body.includes(MARKER))
  if (existing) await client.updateComment(existing.id, body)
  else await client.createComment(prNumber, body)
}

/** A real GitHub REST client. `token` is sent in the Authorization header only. */
export function createGitHubClient(apiUrl: string, repo: string, token: string): GitHubClient {
  const base = `${apiUrl.replace(/\/$/, '')}/repos/${repo}`
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  }
  return {
    async listComments(prNumber) {
      const res = await fetch(`${base}/issues/${prNumber}/comments?per_page=100`, { headers })
      if (!res.ok) return []
      return (await res.json()) as IssueComment[]
    },
    async createComment(prNumber, body) {
      await fetch(`${base}/issues/${prNumber}/comments`, { method: 'POST', headers, body: JSON.stringify({ body }) })
    },
    async updateComment(commentId, body) {
      await fetch(`${base}/issues/comments/${commentId}`, { method: 'PATCH', headers, body: JSON.stringify({ body }) })
    },
  }
}
