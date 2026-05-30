// errors.ts — typed CLI errors mapped to stable exit codes + actionable hints.
//
// Throw a CliError (or subclass) anywhere; the top-level handler in index.ts
// renders it via ui.error (message + hint, stack only under --verbose) and
// exits with its code. Exit codes are part of the CLI's contract — scripts and
// CI depend on them, so they must stay stable.

/** Stable process exit codes per failure class. */
export const ExitCode = {
  OK: 0,
  GENERIC: 1,
  USAGE: 2, // bad flags / arguments (commander also uses 2)
  NOT_INITIALIZED: 3, // no design-spec.schema.json found
  INVALID_SCHEMA: 4, // schema fails validation
  STALE_OUTPUT: 5, // generated output drifted from schema (lint/hook)
  IO: 6, // filesystem error
  NOT_IMPLEMENTED: 7, // command requires a surface not available yet
} as const

export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode]

export class CliError extends Error {
  readonly code: string
  readonly exitCode: ExitCodeValue
  readonly hint?: string

  constructor(message: string, opts: { code: string; exitCode: ExitCodeValue; hint?: string; cause?: unknown }) {
    super(message)
    this.name = 'CliError'
    this.code = opts.code
    this.exitCode = opts.exitCode
    this.hint = opts.hint
    if (opts.cause !== undefined) this.cause = opts.cause
  }
}

export class NotInitializedError extends CliError {
  constructor(cwd: string) {
    super('No design-spec.schema.json found in this project.', {
      code: 'E_NOT_INITIALIZED',
      exitCode: ExitCode.NOT_INITIALIZED,
      hint: `Run "design-spec init" in ${cwd} to create one.`,
    })
    this.name = 'NotInitializedError'
  }
}

export class InvalidSchemaError extends CliError {
  constructor(detail: string, cause?: unknown) {
    super(`design-spec.schema.json is invalid: ${detail}`, {
      code: 'E_INVALID_SCHEMA',
      exitCode: ExitCode.INVALID_SCHEMA,
      hint: 'Fix the schema, or run "design-spec lint" to see all problems.',
      cause,
    })
    this.name = 'InvalidSchemaError'
  }
}

export class StaleOutputError extends CliError {
  constructor(files: string[]) {
    super(`Generated output is stale (${files.length} file(s) differ from the schema).`, {
      code: 'E_STALE_OUTPUT',
      exitCode: ExitCode.STALE_OUTPUT,
      hint: 'Run "design-spec compile" and stage the result.',
    })
    this.name = 'StaleOutputError'
  }
}

export class NotImplementedError extends CliError {
  constructor(what: string, hint: string) {
    super(`${what} is not available in this release.`, {
      code: 'E_NOT_IMPLEMENTED',
      exitCode: ExitCode.NOT_IMPLEMENTED,
      hint,
    })
    this.name = 'NotImplementedError'
  }
}

/** Coerce any thrown value into a CliError for uniform rendering. */
export function toCliError(e: unknown): CliError {
  if (e instanceof CliError) return e
  const message = e instanceof Error ? e.message : String(e)
  return new CliError(message, { code: 'E_UNEXPECTED', exitCode: ExitCode.GENERIC, cause: e })
}
