<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useHead } from '@unhead/vue'
import { ArrowLeft, Check, Copy, Frame, GitFork, KeyRound, ShieldCheck, Terminal, Trash2 } from '@lucide/vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import ExportSettings from '@/components/settings/ExportSettings.vue'
import PresentationSettings from '@/components/settings/PresentationSettings.vue'
import { useImportStore } from '@/stores/useImportStore'
import { useFigmaStore } from '@/stores/useFigmaStore'
import { useSyncStore } from '@/stores/useSyncStore'
import { sessionToken } from '@/utils/api'
import { maskedPat } from '@/utils/figma/pat'

// The OAuth callback lands here, so this is where the GitHub connection is
// managed. `init()` picks the session out of the URL fragment and scrubs it from
// the address bar before anything else reads it.
//
// It is also where both Figma credentials are explained, because they are
// different things and the difference is the whole security story: the PAT is
// this browser's and never leaves it, while the session the plugin uses is the
// same one this app already holds.

useHead({ title: 'Settings — Design Spec' })

const imports = useImportStore()
const figma = useFigmaStore()
const sync = useSyncStore()
const { busy, error, connected, canPush, login } = storeToRefs(imports)
const { pat } = storeToRefs(figma)
const { keys, projects, revealedKey, busy: syncBusy, error: syncError } = storeToRefs(sync)

// A key is shown once, straight from the response that minted it. Copying is a
// convenience; the value is on screen and selectable either way.
const keyCopied = ref(false)
async function copyKey() {
  if (!revealedKey.value?.key) return
  try {
    await navigator.clipboard.writeText(revealedKey.value.key)
    keyCopied.value = true
    setTimeout(() => (keyCopied.value = false), 2000)
  } catch {
    /* clipboard denied — the key is still visible */
  }
}

const ENVIRONMENTS = ['live', 'test'] as const

function keyFor(env: 'live' | 'test') {
  return keys.value.find((k) => k.environment === env) ?? null
}

function when(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString() : 'never'
}

const router = useRouter()
const route = useRoute()

// §17: three tabs, one per configuration layer. The tab is in the URL
// (?tab=export|presentation|integrations) so it survives a reload and can be
// linked to. Integrations is the default: the OAuth callback lands here.
const TABS = [
  { id: 'export', label: 'Export' },
  { id: 'presentation', label: 'Presentation' },
  { id: 'integrations', label: 'Integrations' },
] as const
type Tab = (typeof TABS)[number]['id']
const tab = computed<Tab>(() => {
  const q = route.query.tab
  return TABS.some((t) => t.id === q) ? (q as Tab) : 'integrations'
})
function selectTab(id: Tab) {
  void router.replace({ query: { ...route.query, tab: id } })
}
function onTabKey(e: KeyboardEvent) {
  const i = TABS.findIndex((t) => t.id === tab.value)
  const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
  if (!step) return
  e.preventDefault()
  const next = TABS[(i + step + TABS.length) % TABS.length].id
  selectTab(next)
  document.getElementById(`settings-tab-${next}`)?.focus()
}

// Deleting a dashboard project asks once, inline, before it goes.
const confirmingDelete = ref<string | null>(null)
async function deleteProject(slug: string) {
  confirmingDelete.value = null
  await sync.deleteProject(slug)
}

/** Open a dashboard project as a linked workspace, then go edit it. */
async function openProject(slug: string) {
  await sync.openProject(slug)
  if (!syncError.value) await router.push('/workspace')
}

async function generate(env: 'live' | 'test') {
  keyCopied.value = false
  await sync.generateKey(env)
}

const hasPat = computed(() => pat.value.trim().length > 0)

const revealed = ref(false)
const copied = ref(false)
const session = computed(() => sessionToken() ?? '')

async function copySession() {
  try {
    await navigator.clipboard.writeText(session.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    // Clipboard permission denied — revealing it is the fallback, and the
    // button below already offers that.
    revealed.value = true
  }
}

onMounted(async () => {
  await imports.init()
  await figma.init()
  await sync.init()
})
</script>

<template>
  <main class="settings">
    <header class="settings__head">
      <RouterLink to="/workspace" class="settings__back">
        <ArrowLeft :size="14" aria-hidden="true" />
        Workspace
      </RouterLink>
      <h1 class="settings__title">Settings</h1>
      <div class="tabs" role="tablist" aria-label="Settings" @keydown="onTabKey">
        <button
          v-for="t in TABS"
          :id="`settings-tab-${t.id}`"
          :key="t.id"
          class="tab"
          :class="{ 'tab--on': tab === t.id }"
          role="tab"
          :aria-selected="tab === t.id"
          :aria-controls="`settings-panel-${t.id}`"
          :tabindex="tab === t.id ? 0 : -1"
          :data-testid="`settings-tab-${t.id}`"
          @click="selectTab(t.id)"
        >
          {{ t.label }}
        </button>
      </div>
    </header>

    <div
      v-if="tab === 'export'"
      id="settings-panel-export"
      class="panel"
      role="tabpanel"
      aria-labelledby="settings-tab-export"
    >
      <ExportSettings />
    </div>

    <div
      v-else-if="tab === 'presentation'"
      id="settings-panel-presentation"
      class="panel"
      role="tabpanel"
      aria-labelledby="settings-tab-presentation"
    >
      <PresentationSettings />
    </div>

    <div
      v-else
      id="settings-panel-integrations"
      class="panel"
      role="tabpanel"
      aria-labelledby="settings-tab-integrations"
    >
      <section class="card">
        <h2 class="card__title">
          <GitFork :size="15" aria-hidden="true" />
          GitHub
        </h2>

        <p v-if="!imports.available" class="card__text">
          Cloud import isn't enabled in this build. The local CLI runs the same scan on your machine,
          unmetered and without an account:
          <code class="code">npx @design-spec/cli init</code>
        </p>

        <template v-else>
          <p v-if="error" class="error" role="alert">{{ error }}</p>

          <template v-if="connected">
            <p class="card__text">
              Connected as <strong class="mono">{{ login }}</strong>.
            </p>
            <ul class="grants">
              <li class="grant grant--on">
                <Check :size="12" aria-hidden="true" />
                Read public repositories
              </li>
              <li class="grant" :class="{ 'grant--on': canPush }">
                <Check v-if="canPush" :size="12" aria-hidden="true" />
                <span v-else class="grant__dot" aria-hidden="true" />
                Read private repositories and open pull requests
              </li>
            </ul>
            <div class="card__actions">
              <button v-if="!canPush" class="btn btn--primary" :disabled="busy" @click="imports.connect(true)">
                Grant repository access
              </button>
              <button class="btn btn--ghost" :disabled="busy" @click="imports.disconnect()">Disconnect</button>
            </div>
            <p class="card__fine">
              Disconnecting revokes the grant with GitHub and deletes the stored token. Your workspaces
              are local and stay put.
            </p>
          </template>

          <template v-else>
            <p class="card__text">
              Connect GitHub to scan an existing codebase and populate a workspace from it. Files are
              read to extract tokens and are never stored — only the design system they produce is.
            </p>
            <div class="card__actions">
              <button class="btn btn--primary" :disabled="busy" @click="imports.connect(false)">
                <GitFork :size="14" aria-hidden="true" />
                Connect GitHub
              </button>
            </div>
            <p class="card__fine">
              Starts with read access to public repositories only. Private repos and pull requests ask
              separately, when you need them.
            </p>
          </template>
        </template>
      </section>

      <section class="card">
        <h2 class="card__title">
          <Frame :size="15" aria-hidden="true" />
          Figma
        </h2>

        <p class="card__text">
          <template v-if="hasPat">
            A personal access token is stored in this browser
            (<span class="mono">{{ maskedPat(pat) }}</span
            >). It is used to call Figma from this tab.
          </template>
          <template v-else>
            No Figma token is stored. The import dialog asks for one when you first read a file.
          </template>
        </p>

        <p class="privacy">
          <ShieldCheck :size="12" aria-hidden="true" />
          <span>
            Your Figma token never reaches Design Spec's servers — the browser calls Figma directly,
            and our API has no code that talks to Figma at all. Forgetting it here removes it from this
            browser; revoking it in Figma revokes it everywhere.
          </span>
        </p>

        <div v-if="hasPat" class="card__actions">
          <button class="btn btn--ghost" @click="figma.forgetPat()">Forget Figma token</button>
        </div>

        <h3 class="card__sub">Token Sandbox plugin</h3>
        <p class="card__text">
          The Figma plugin reads token changes you stage for approval. It signs in with this Design
          Spec session — never with a Figma token.
        </p>
        <template v-if="connected && session">
          <div class="stored">
            <span class="stored__value">{{ revealed ? session : '••••••••••••••••••••' }}</span>
            <button class="stored__link" @click="revealed = !revealed">
              {{ revealed ? 'Hide' : 'Reveal' }}
            </button>
          </div>
          <div class="card__actions">
            <button class="btn btn--ghost" data-testid="copy-session" @click="copySession">
              <component :is="copied ? Check : Copy" :size="13" aria-hidden="true" />
              {{ copied ? 'Copied' : 'Copy session for the plugin' }}
            </button>
          </div>
          <p class="card__fine">
            Paste it into the plugin along with your account name,
            <span class="mono">{{ login }}</span
            >. Treat it like a password: anyone holding it can act as you until it expires.
          </p>
        </template>
        <p v-else class="card__fine">Connect GitHub above to get a session the plugin can use.</p>
      </section>

      <section class="card" data-testid="developer-card">
        <h2 class="card__title">
          <KeyRound :size="15" aria-hidden="true" />
          Developer
        </h2>

        <p v-if="!sync.available" class="card__fine">
          Connect GitHub above to create API keys for the CLI's
          <span class="mono">sync</span> and <span class="mono">push</span>.
        </p>

        <template v-else>
          <p class="card__text">
            API keys let the CLI pull this dashboard's presentation settings
            (<span class="mono">design-spec sync</span>) and push your schema to it
            (<span class="mono">design-spec push</span>). They reach your dashboard projects and
            nothing else — not GitHub, not billing.
          </p>
          <p v-if="syncError" class="error" role="alert">{{ syncError }}</p>

          <div v-if="revealedKey?.key" class="reveal" data-testid="revealed-key" role="status">
            <p class="reveal__head">
              New {{ revealedKey.environment }} key — copy it now. It won't be shown again.
            </p>
            <div class="stored">
              <span class="stored__value" data-testid="revealed-key-value">{{ revealedKey.key }}</span>
              <button class="stored__link" @click="copyKey">{{ keyCopied ? 'Copied' : 'Copy' }}</button>
            </div>
            <p class="card__fine">
              Set it in your shell's environment rather than on the command line, where it would land
              in your history. Then:
            </p>
            <code class="code" data-testid="revealed-key-usage">DESIGN_SPEC_API_KEY=… npx @design-spec/cli sync</code>
            <div class="card__actions">
              <button class="btn btn--ghost" @click="sync.dismissRevealedKey()">Done</button>
            </div>
          </div>

          <ul class="keys">
            <li v-for="env in ENVIRONMENTS" :key="env" class="key" :data-testid="'key-' + env">
              <div class="key__main">
                <span class="key__label">{{ env === 'live' ? 'Live' : 'Test' }}</span>
                <span v-if="keyFor(env)" class="mono key__mask">
                  {{ keyFor(env)!.prefix }}…{{ keyFor(env)!.last4 }}
                </span>
                <span v-else class="key__none">No key</span>
              </div>
              <span v-if="keyFor(env)" class="card__fine">
                Created {{ when(keyFor(env)!.created_at) }} · last used
                {{ when(keyFor(env)!.last_used_at) }}
              </span>
              <div class="card__actions">
                <button
                  class="btn btn--primary"
                  :data-testid="'generate-' + env"
                  :disabled="syncBusy"
                  @click="generate(env)"
                >
                  {{ keyFor(env) ? 'Regenerate' : 'Generate' }}
                </button>
                <button
                  v-if="keyFor(env)"
                  class="btn btn--ghost"
                  :data-testid="'revoke-' + env"
                  :disabled="syncBusy"
                  @click="sync.revokeKey(keyFor(env)!.id)"
                >
                  Revoke
                </button>
              </div>
            </li>
          </ul>
          <p class="card__fine">
            Keys are stored only as a hash. Regenerating revokes the old key immediately. The CLI keeps
            your key in <span class="mono">~/.config/design-spec/config.json</span>, never in the
            project.
          </p>

          <h3 class="card__sub">Dashboard projects</h3>
          <p v-if="projects.length === 0" class="card__fine">
            None yet. Run <span class="mono">design-spec push</span> in a project, or save a
            workspace to the dashboard from its header.
          </p>
          <ul v-else class="projects" data-testid="dashboard-projects">
            <li v-for="p in projects" :key="p.project" class="project">
              <div class="key__main">
                <span class="key__label">{{ p.name || p.project }}</span>
                <span class="mono key__mask">{{ p.project }} · rev {{ p.revision }}</span>
              </div>
              <span class="card__fine">
                Last saved from {{ p.updated_by === 'cli' ? 'the CLI' : 'the web' }} ·
                {{ when(p.updated_at) }}
              </span>
              <div class="card__actions">
                <button
                  class="btn btn--primary"
                  :data-testid="'open-' + p.project"
                  :disabled="syncBusy"
                  @click="openProject(p.project)"
                >
                  Open in workspace
                </button>
                <template v-if="confirmingDelete === p.project">
                  <button
                    class="btn btn--danger"
                    :data-testid="'confirm-delete-' + p.project"
                    :disabled="syncBusy"
                    @click="deleteProject(p.project)"
                  >
                    Delete for good
                  </button>
                  <button class="btn btn--ghost" @click="confirmingDelete = null">Keep it</button>
                </template>
                <button
                  v-else
                  class="btn btn--ghost"
                  :data-testid="'delete-' + p.project"
                  :disabled="syncBusy"
                  @click="confirmingDelete = p.project"
                >
                  <Trash2 :size="13" aria-hidden="true" />
                  Delete
                </button>
              </div>
              <p v-if="confirmingDelete === p.project" class="card__fine" role="status">
                Deletes the dashboard copy for everyone using it. Workspaces in this browser stay; they
                just stop being linked. A developer can push it again.
              </p>
            </li>
          </ul>
          <p class="card__fine">
            Presentation settings (bento layout, branding, sharing) saved here win on the developer's
            next <span class="mono">sync</span>. Their export settings stay theirs unless they pass
            <span class="mono">--force</span>.
          </p>
        </template>
      </section>

      <section class="card">
        <h2 class="card__title">
          <Terminal :size="15" aria-hidden="true" />
          Local CLI
        </h2>
        <p class="card__text">
          The CLI does everything the cloud scan does, on your machine, with no account and no monthly
          limit — and it can read configs the cloud scanner can't, because it may evaluate your own
          JavaScript.
        </p>
        <code class="code">npx @design-spec/cli init</code>
      </section>
    </div>
  </main>
</template>

<style scoped>
.settings {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  max-width: 640px;
  margin: 0 auto;
  padding: var(--spacing-xl) var(--spacing-md);
  min-height: 100dvh;
  background-color: var(--color-surface-page);
}

.settings__head {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}
.settings__back {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  align-self: flex-start;
  font-family: var(--font-sans);
  font-size: 12px;
  color: var(--color-on-surface-muted);
  text-decoration: none;
}
.settings__back:hover {
  color: var(--color-on-surface);
}
.settings__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 30px;
  font-weight: 400;
  color: var(--color-on-surface);
}

.card {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding: var(--spacing-lg);
  background-color: var(--color-surface-default);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-lg);
}
.card__title {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0;
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 400;
  color: var(--color-on-surface);
}
.card__text {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 13px;
  line-height: 1.6;
  color: var(--color-on-surface-muted);
}
.card__fine {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 11px;
  line-height: 1.5;
  color: var(--color-on-surface-subtle);
}
.card__actions {
  display: flex;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
}

.mono {
  font-family: var(--font-mono);
  font-weight: 400;
  color: var(--color-on-surface);
}

.grants {
  display: flex;
  flex-direction: column;
  gap: 5px;
  list-style: none;
  margin: 0;
  padding: 0;
}
.grant {
  display: flex;
  align-items: center;
  gap: 7px;
  font-family: var(--font-sans);
  font-size: 12px;
  color: var(--color-on-surface-subtle);
}
.grant--on {
  color: var(--color-on-surface);
}
.grant--on svg {
  color: var(--color-status-success);
}
.grant__dot {
  width: 12px;
  height: 12px;
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-full);
}

.card__sub {
  margin: var(--spacing-sm) 0 0;
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-on-surface-subtle);
}

.privacy {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  margin: 0;
  padding: var(--spacing-sm);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  background-color: var(--color-surface-sunken);
  font-family: var(--font-sans);
  font-size: 11px;
  line-height: 1.55;
  color: var(--color-on-surface-muted);
}
.privacy svg {
  flex-shrink: 0;
  margin-top: 2px;
  color: var(--color-status-success);
}

.stored {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  min-height: 34px;
  padding: 0 var(--spacing-sm);
  background-color: var(--color-surface-sunken);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
}
.stored__value {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--color-on-surface);
}
.stored__link {
  background: none;
  border: none;
  padding: 0;
  font-family: var(--font-sans);
  font-size: 11px;
  color: var(--color-on-surface-muted);
  cursor: pointer;
}
.stored__link:hover {
  color: var(--color-on-surface);
}

.code {
  display: inline-block;
  align-self: flex-start;
  padding: 6px 9px;
  border-radius: var(--radius-sm);
  background-color: var(--color-surface-sunken);
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--color-on-surface);
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 34px;
  padding: 0 var(--spacing-md);
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}
.btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--color-interactive-focus-ring);
}
.btn:disabled {
  opacity: 0.5;
  cursor: default;
}
.btn--primary {
  background-color: var(--color-primary);
  color: var(--color-on-primary);
}
.btn--primary:hover:not(:disabled) {
  background-color: var(--color-primary-glow);
}
.btn--ghost {
  background: none;
  border-color: var(--color-surface-border);
  color: var(--color-on-surface-muted);
}
.btn--ghost:hover:not(:disabled) {
  color: var(--color-status-error);
  border-color: var(--color-status-error);
}

.error {
  margin: 0;
  padding: var(--spacing-sm);
  border: 1px solid color-mix(in srgb, var(--color-status-error) 45%, transparent);
  border-radius: var(--radius-sm);
  background-color: color-mix(in srgb, var(--color-status-error) 10%, transparent);
  font-family: var(--font-sans);
  font-size: 12px;
  color: var(--color-on-surface);
}

.reveal {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm);
  border: 1px solid color-mix(in srgb, var(--color-status-warning) 45%, transparent);
  border-radius: var(--radius-sm);
  background-color: color-mix(in srgb, var(--color-status-warning) 8%, transparent);
}
.reveal__head {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 600;
  color: var(--color-on-surface);
}
.reveal .code {
  max-width: 100%;
  overflow-x: auto;
  white-space: nowrap;
}

.keys,
.projects {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  list-style: none;
  margin: 0;
  padding: 0;
}
.key,
.project {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: var(--spacing-sm);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
}
.key__main {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}
.key__label {
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 600;
  color: var(--color-on-surface);
}
.key__mask {
  font-size: 12px;
}
.key__none {
  font-family: var(--font-sans);
  font-size: 12px;
  color: var(--color-on-surface-subtle);
}

.tabs {
  display: flex;
  gap: 2px;
  border-bottom: 1px solid var(--color-surface-border);
}
.tab {
  min-height: 36px;
  padding: 0 var(--spacing-md);
  margin-bottom: -1px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 500;
  color: var(--color-on-surface-muted);
  cursor: pointer;
}
.tab:hover {
  color: var(--color-on-surface);
}
.tab:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--color-interactive-focus-ring);
}
.tab--on {
  border-bottom-color: var(--color-primary);
  color: var(--color-on-surface);
}
.panel {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.btn--danger {
  background-color: var(--color-status-error);
  color: var(--color-on-primary);
}
</style>
