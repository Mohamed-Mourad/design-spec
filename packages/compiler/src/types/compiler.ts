// types/compiler.ts — shared compiler I/O contract.

/** One emitted file. Compilers return `FileOutput[]`. */
export interface FileOutput {
  /** Relative path, e.g. "tailwind.config.js", "DESIGN.md", "tokens.css". */
  filename: string
  /** Full file contents. */
  content: string
  /** Language id, for syntax highlighting in the web preview. */
  language: string
}
