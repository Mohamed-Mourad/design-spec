// write.ts — atomic file write helper.
//
// Agents and editors read generated output continuously. A non-atomic write
// (truncate + stream) lets a reader observe a half-written file. We write to a
// sibling `.tmp` then `rename()` — POSIX/Windows rename is atomic on the same
// volume, so a reader sees the complete old file or the complete new one,
// never a partial. This is the invariant `watch` depends on.

import { writeFile, rename, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

/**
 * Atomically write `content` to `filePath`. Creates parent dirs as needed.
 * Returns the path written, for ergonomic logging.
 */
export async function atomicWrite(filePath: string, content: string): Promise<string> {
  await mkdir(dirname(filePath), { recursive: true })
  // Unique-ish temp sibling so concurrent writers to different files don't clash.
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`
  await writeFile(tmp, content, 'utf8')
  await rename(tmp, filePath)
  return filePath
}
