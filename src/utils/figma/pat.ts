// The Figma personal access token.
//
// This is the one secret in the app that has a stricter rule than the session
// JWT: it lives in this browser and nowhere else. It is never sent to the
// Design Spec API, never written into `design-spec.schema.json`, never attached
// to a telemetry event, and never logged — the backend has no code path that
// calls Figma, by design (architecture-plan.md §15, §19.1).
//
// Everything that reads it goes through here, so "who can see the PAT" is a
// question with a one-file answer.

const PAT_KEY = 'dsa-figma-pat'

export function figmaPat(): string | null {
  try {
    return localStorage.getItem(PAT_KEY)
  } catch {
    return null
  }
}

export function setFigmaPat(token: string): void {
  try {
    localStorage.setItem(PAT_KEY, token.trim())
  } catch {
    /* private mode — the token just won't survive a reload */
  }
}

export function clearFigmaPat(): void {
  try {
    localStorage.removeItem(PAT_KEY)
  } catch {
    /* nothing to clear */
  }
}

/**
 * A PAT rendered for display: enough to recognise which token is stored,
 * never enough to use. Figma tokens are long and prefixed (`figd_…`), so the
 * prefix plus the last four characters identifies one without revealing it.
 */
export function maskedPat(token: string): string {
  const trimmed = token.trim()
  if (trimmed.length <= 8) return '••••'
  return `${trimmed.slice(0, 5)}…${trimmed.slice(-4)}`
}
