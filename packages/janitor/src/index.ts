// index.ts — public surface of the janitor package (consumed by tests and any
// programmatic caller). The action entrypoint is action.ts.

export { parseConfig, prNumberFromEvent, BOT_NAME, BOT_EMAIL, type JanitorConfig } from './config.js'
export { createGit, headCommitMeta, configureBotIdentity, type Git, type GitResult, type HeadMeta } from './checkout.js'
export { scanDrift, generatedFilenames, type FileDrift } from './detect.js'
export { applyFixes, type FixResult, type ChangedFile, type DriftRow } from './fix.js'
export { commitAndPush, commitMessage, isProtectedRef, type CommitOutcome, type CommitParams } from './commit.js'
export {
  buildComment,
  upsertComment,
  createGitHubClient,
  MARKER,
  type GitHubClient,
  type IssueComment,
} from './prComment.js'
export { run, type RunnerDeps, type RunResult, type Logger } from './runner.js'
