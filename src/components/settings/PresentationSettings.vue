<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { RouterLink } from 'vue-router'
import { Brush, LayoutGrid } from '@lucide/vue'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'

// Settings → Presentation: Layer 3 of §17 — the bento layout, proposal
// branding and sharing. Those already have editors next to the preview they
// change, so this tab summarizes the active workspace's `presentation` and
// links there rather than growing a second copy of each editor.
//
// This layer is the designer's: on the dashboard it wins over a developer's
// local copy on their next `design-spec sync`.

const store = useDesignSystemStore()
const { schema } = storeToRefs(store)
const p = computed(() => schema.value.presentation)

const layout = computed(() => {
  const l = p.value?.bentoLayout
  if (!l) return 'Default layout'
  const visible = l.cells.filter((c) => c.visible !== false).length
  return `${visible} of ${l.cells.length} cells · ${l.gridColumns} columns · ${l.theme} theme`
})
const branding = computed(() => {
  const b = p.value?.proposalBranding
  if (!b || (!b.companyName && !b.logoUrl && !b.accentColor)) return 'Not set'
  return [b.companyName, b.accentColor, b.logoUrl ? 'logo' : null].filter(Boolean).join(' · ')
})
const sharing = computed(() => {
  const slug = p.value?.publicSlug
  const embed = p.value?.embedOptions
  const parts = [slug ? `/p/${slug}` : 'Not published']
  if (embed) parts.push(embed.allowIframe ? 'embeddable' : 'embed off')
  return parts.join(' · ')
})
const ogImage = computed(() =>
  p.value?.ogImageStrategy === 'server-render' ? 'Server-rendered' : 'Drawn in the browser',
)
</script>

<template>
  <section class="card" data-testid="presentation-settings">
    <h2 class="card__title">Presentation</h2>
    <p class="card__text">
      How <span class="mono">{{ schema.name }}</span> is shown to people: the bento preview, proposal
      branding and sharing. Saved to the dashboard, this wins on a developer's next
      <span class="mono">design-spec sync</span>.
    </p>

    <dl class="summary" data-testid="presentation-summary">
      <dt>Bento layout</dt>
      <dd>{{ layout }}</dd>
      <dt>Branding</dt>
      <dd>{{ branding }}</dd>
      <dt>Sharing</dt>
      <dd>{{ sharing }}</dd>
      <dt>Social card</dt>
      <dd>{{ ogImage }}</dd>
    </dl>

    <div class="card__actions">
      <RouterLink class="btn" data-testid="edit-layout" :to="{ path: '/preview', query: { panel: 'layout' } }">
        <LayoutGrid :size="14" aria-hidden="true" />
        Edit the layout
      </RouterLink>
      <RouterLink class="btn" data-testid="edit-branding" :to="{ path: '/preview', query: { panel: 'branding' } }">
        <Brush :size="14" aria-hidden="true" />
        Branding &amp; publishing
      </RouterLink>
    </div>
  </section>
</template>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  background-color: var(--color-surface-default);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-lg);
}
.card__title {
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
.card__actions {
  display: flex;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
}
.mono {
  font-family: var(--font-mono);
  color: var(--color-on-surface);
}

.summary {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 6px var(--spacing-md);
  margin: 0;
  font-family: var(--font-sans);
  font-size: 13px;
}
.summary dt {
  color: var(--color-on-surface-subtle);
}
.summary dd {
  margin: 0;
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--color-on-surface);
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 34px;
  padding: 0 var(--spacing-md);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 500;
  color: var(--color-on-surface);
  text-decoration: none;
}
.btn:hover {
  border-color: var(--color-primary);
}
.btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--color-interactive-focus-ring);
}
</style>
