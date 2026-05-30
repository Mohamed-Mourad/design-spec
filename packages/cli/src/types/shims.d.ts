// Ambient shims for dependencies that ship no TypeScript declarations.

declare module 'update-notifier' {
  interface UpdateNotifierOptions {
    pkg: { name: string; version: string }
    updateCheckInterval?: number
  }
  interface Notifier {
    notify(opts?: { defer?: boolean; message?: string }): void
  }
  export default function updateNotifier(options: UpdateNotifierOptions): Notifier
}
