<script setup lang="ts">
import { onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useHead } from '@unhead/vue'
import { ArrowLeft, Check, GitFork, Terminal } from '@lucide/vue'
import { RouterLink } from 'vue-router'
import { useImportStore } from '@/stores/useImportStore'

// The OAuth callback lands here, so this is where the GitHub connection is
// managed. `init()` picks the session out of the URL fragment and scrubs it from
// the address bar before anything else reads it.

useHead({ title: 'Settings — Design Spec' })

const imports = useImportStore()
const { busy, error, connected, canPush, login } = storeToRefs(imports)

onMounted(() => imports.init())
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
