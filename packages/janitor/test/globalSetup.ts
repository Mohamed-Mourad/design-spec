// Build the compiler then the janitor once before the suite, so the janitor's
// dist and its @design-spec/compiler dependency are current.

import { execSync } from 'node:child_process'
import { resolve } from 'node:path'

export default function setup(): void {
  const repoRoot = resolve(__dirname, '../../..')
  execSync('npm run build --workspace @design-spec/compiler', { cwd: repoRoot, stdio: 'inherit' })
  execSync('npm run build --workspace @design-spec/janitor', { cwd: repoRoot, stdio: 'inherit' })
}
