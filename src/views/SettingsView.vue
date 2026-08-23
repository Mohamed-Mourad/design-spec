<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useHead } from '@unhead/vue'
import { ArrowLeft, Check, Copy, Frame, GitFork, ShieldCheck, Terminal } from '@lucide/vue'
import { RouterLink } from 'vue-router'
import { useImportStore } from '@/stores/useImportStore'
import { useFigmaStore } from '@/stores/useFigmaStore'
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
const { busy, error, connected, canPush, login } = storeToRefs(imports)
const { pat } = storeToRefs(figma)

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
    </header>

    <section class="card">
      <h2 class="card__title">
        <GitFork :size="15" aria-hidden="true" />
        GitHub
      </h2>

      <p v-if="!imports.available" class="card__text">
        Cloud import isn't enabled in this build. The local CLI runs the same scan on your machine,
        unmetered and without an account:
        <code class="code">npx design-spec init</code>
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
      <code class="code">npx design-spec init</code>
    </section>

    <p class="stub">Export settings, font loading, and naming conventions are still to come.</p>
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

.stub {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 11px;
  color: var(--color-on-surface-subtle);
}
</style>
