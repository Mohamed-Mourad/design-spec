// Map a variant name (and common synonyms) to one of the semantic status roles,
// so naming a variant "danger" / "ok" / "caution" auto-applies the right tokens.

export type Status = 'error' | 'warning' | 'success' | 'info'

const ALIASES: Record<Status, string[]> = {
  error: ['error', 'danger', 'destructive', 'fail', 'failure', 'critical', 'negative'],
  warning: ['warning', 'warn', 'caution'],
  success: ['success', 'ok', 'okay', 'done', 'positive', 'valid', 'confirmed', 'complete'],
  info: ['info', 'information', 'informational', 'note', 'neutral'],
}

/** The status a variant name maps to, or null. Checked error→warning→success→info. */
export function matchStatus(name: string): Status | null {
  const n = name.toLowerCase().trim()
  if (!n) return null
  for (const status of ['error', 'warning', 'success', 'info'] as Status[]) {
    if (ALIASES[status].some((a) => n === a || n.includes(a))) return status
  }
  return null
}

/** Token overrides for a status variant: surface bg + status border (icon follows). */
export function statusVariantTokens(status: Status): Record<string, string> {
  return {
    backgroundColor: `{colors.status-${status}-surface}`,
    borderColor: `{colors.status-${status}}`,
  }
}
