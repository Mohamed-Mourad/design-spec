// Build the compiler then the CLI once before the integration suite runs, so
// the spawned binary (dist/index.js) and its @design-spec/compiler dependency
// are current.

import { execSync } from 'node:child_process'
import { resolve } from 'node:path'

export default function setup(): void {
  const repoRoot = resolve(__dirname, '../../..')
  execSync('npm run build --workspace @design-spec/compiler', { cwd: repoRoot, stdio: 'inherit' })
  execSync('npm run build --workspace design-spec', { cwd: repoRoot, stdio: 'inherit' })
}
