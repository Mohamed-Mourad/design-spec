<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useHead } from '@unhead/vue'
import BentoPreview from '@/components/preview/bento/BentoPreview.vue'
import { usePublishedSchema } from '@/composables/usePublishedSchema'

// The public face of a published proposal: /p/{slug}. No chrome, no account,
// no workspace — a reader who lands here is looking at somebody's work, not
// using an editor.

const route = useRoute()
const { schema, proposal, loading, error, loadProposal } = usePublishedSchema()

const slug = computed(() => String(route.params.slug ?? ''))
const branding = computed(() => schema.value?.presentation?.proposalBranding)

onMounted(() => loadProposal(slug.value))

const title = computed(() => {
  const name = schema.value?.name
  const company = branding.value?.companyName
  if (!name) return 'Design Spec'
  return company ? `${name} — ${company}` : name
})

const description = computed(
  () =>
    schema.value?.description ||
    (schema.value ? `The ${schema.value.name} design system.` : 'A published design system.'),
)

useHead({
  title,
  meta: computed(() => {
    const tags = [
      { name: 'description', content: description.value },
      { property: 'og:type', content: 'website' },
      { property: 'og:title', content: title.value },
      { property: 'og:description', content: description.value },
      { name: 'twitter:card', content: 'summary_large_image' },
    ]
    // The server-rendered card, once it exists. Until then the tag is absent
    // rather than pointing at a URL that would 404 for a crawler.
    if (proposal.value?.og_image_url) {
      tags.push(
        { property: 'og:image', content: proposal.value.og_image_url },
        { name: 'twitter:image', content: proposal.value.og_image_url },
      )
    }
    return tags
  }),
})
</script>

<template>
  <div class="proposal-view">
    <p v-if="loading" class="proposal-view__state" data-testid="proposal-loading">Loading…</p>

    <div v-else-if="error" class="proposal-view__state" data-testid="proposal-error">
      <p class="proposal-view__error">{{ error }}</p>
      <RouterLink class="proposal-view__home" to="/">Design Spec</RouterLink>
    </div>

    <BentoPreview v-else-if="schema" :schema="schema" :branding="branding" />
  </div>
</template>

<style scoped>
.proposal-view {
  min-height: 100dvh;
  background-color: var(--color-surface-page);
}

.proposal-view__state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-md);
  min-height: 100dvh;
  font-family: var(--font-sans);
  font-size: 14px;
  color: var(--color-on-surface-muted);
}

.proposal-view__error {
  margin: 0;
}

.proposal-view__home {
  font-size: 13px;
  color: var(--color-primary);
}
</style>
