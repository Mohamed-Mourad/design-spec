// sync/credentials.ts — which API key and which API host a sync uses.
//
// Key precedence: --key → DESIGN_SPEC_API_KEY → ~/.config/design-spec/config.json.
// A key passed with --key is remembered in the machine config (§16.4) so the
// next run needs no flag. That file is per-user and never inside a project, so
// a key can't be committed by accident; on POSIX it is written 0600.
//
// The key is never printed. Anything user-facing shows `maskKey()`.

import { chmod } from 'node:fs/promises'
import { CliError, ExitCode } from '../errors.js'
import { loadGlobalConfig, saveGlobalConfig } from '../globalConfig.js'

export const DEFAULT_API_URL = 'https://api.design-spec.ai'

const KEY_PATTERN = /^ds_(live|test)_[0-9A-Za-z]{40}$/

export function isWellFormedKey(key: string): boolean {
  return KEY_PATTERN.test(key)
}

/** `ds_live_…a9Qz` — enough to recognise, not enough to use. */
export function maskKey(key: string): string {
  const prefix = key.startsWith('ds_test_') ? 'ds_test_' : 'ds_live_'
  return `${prefix}…${key.slice(-4)}`
}

export interface Credentials {
  key: string
  apiUrl: string
  /** Where the key came from, for messaging. */
  source: 'flag' | 'env' | 'config'
}

/**
 * Resolve the key and API host. Throws an E_AUTH CliError when there is no key
 * or it is malformed — before any network call is made with it.
 */
export async function resolveCredentials(flagKey?: string): Promise<Credentials> {
  const config = await loadGlobalConfig()

  let key: string | undefined
  let source: Credentials['source'] = 'config'
  if (flagKey) {
    key = flagKey.trim()
    source = 'flag'
  } else if (process.env.DESIGN_SPEC_API_KEY) {
    key = process.env.DESIGN_SPEC_API_KEY.trim()
    source = 'env'
  } else {
    key = config.apiKey
  }

  if (!key) {
    throw new CliError('No API key.', {
      code: 'E_AUTH',
      exitCode: ExitCode.AUTH,
      hint: 'Generate one in Settings → Developer on design-spec.ai, then set DESIGN_SPEC_API_KEY (or pass --key once; it is remembered).',
    })
  }
  if (!isWellFormedKey(key)) {
    throw new CliError('That is not a Design Spec API key.', {
      code: 'E_AUTH',
      exitCode: ExitCode.AUTH,
      hint: 'Keys look like ds_live_ or ds_test_ followed by 40 letters and digits.',
    })
  }

  const apiUrl = (process.env.DESIGN_SPEC_API_URL || config.apiUrl || DEFAULT_API_URL).replace(/\/+$/, '')
  assertSafeTransport(apiUrl)
  return { key, apiUrl, source }
}

/**
 * Refuse to send a key over plain HTTP to anything but this machine. A key on
 * the wire in clear text is a key anyone on the network can read.
 */
function assertSafeTransport(apiUrl: string): void {
  let url: URL
  try {
    url = new URL(apiUrl)
  } catch {
    throw new CliError(`Invalid API URL: ${apiUrl}`, { code: 'E_USAGE', exitCode: ExitCode.USAGE })
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) {
    throw new CliError('Refusing to send an API key over an insecure connection.', {
      code: 'E_INSECURE_URL',
      exitCode: ExitCode.USAGE,
      hint: 'Use an https:// API URL (http:// is allowed only for localhost).',
    })
  }
}

/** Remember a key that came from --key. No-op when it is already the saved one. */
export async function rememberKey(creds: Credentials): Promise<string | null> {
  if (creds.source !== 'flag') return null
  const config = await loadGlobalConfig()
  if (config.apiKey === creds.key) return null
  const path = await saveGlobalConfig({ ...config, apiKey: creds.key })
  if (process.platform !== 'win32') await chmod(path, 0o600)
  return path
}
