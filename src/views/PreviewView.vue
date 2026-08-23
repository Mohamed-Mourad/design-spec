<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useHead } from '@unhead/vue'
import { ArrowLeft } from '@lucide/vue'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'
import BentoPreview from '@/components/preview/bento/BentoPreview.vue'
import { renderOgImage } from '@/utils/ogCanvas'

const router = useRouter()
const store = useDesignSystemStore()
const { schema } = storeToRefs(store)

const branding = computed(() => schema.value.presentation?.proposalBranding)

/**
 * The card is drawn once the fonts are ready, so it lands a tick after mount.
 * `og:image` simply carries no value until then — an empty tag beats a data URL
 * of a card rendered in the fallback font.
 */
const ogImage = ref<string | null>(null)

async function paintOgImage() {
  ogImage.value = await renderOgImage(schema.value, { branding: branding.value })
}

onMounted(paintOgImage)
watch(() => schema.value.name, paintOgImage)

const description = computed(
  () =>
    schema.value.description ||
    `The ${schema.value.name} design system — colors, type, spacing and components.`,
)

useHead({
  title: () => `${schema.value.name} — Design Spec`,
  meta: computed(() => {
    const tags = [
      { name: 'description', content: description.value },
      { property: 'og:type', content: 'website' },
      { property: 'og:title', content: schema.value.name },
      { property: 'og:description', content: description.value },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: schema.value.name },
      { name: 'twitter:description', content: description.value },
    ]
    if (ogImage.value) {
      tags.push(
        { property: 'og:image', content: ogImage.value },
        { name: 'twitter:image', content: ogImage.value },
      )
    }
    return tags
  }),
})
</script>

<template>
  <div class="preview-view">
    <!--
      Full-bleed by design: the bento is the page, not a panel inside one. The
      only chrome is a single floating control that gets out of the way, so a
      screenshot of this route is a screenshot of the design system.
    -->
    <button class="preview-view__back" title="Back to the workspace" @click="router.back()">
      <ArrowLeft :size="15" aria-hidden="true" />
      <span>Back</span>
    </button>

    <BentoPreview :schema="schema" :branding="branding" />
  </div>
</template>

<style scoped>
.preview-view {
  position: relative;
  min-height: 100dvh;
  background-color: var(--color-surface-page);
}

.preview-view__back {
  position: fixed;
  top: var(--spacing-md);
  right: var(--spacing-md);
  z-index: var(--z-sticky);
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  min-height: 36px;
  padding: 0 var(--spacing-md);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-md);
  background-color: var(--color-surface-raised);
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--color-on-surface-muted);
  cursor: pointer;
  opacity: 0.55;
}

.preview-view__back:hover {
  color: var(--color-on-surface);
  opacity: 1;
}

.preview-view__back:focus-visible {
  outline: none;
  opacity: 1;
  box-shadow: 0 0 0 2px var(--color-interactive-focus-ring);
}

@media (prefers-reduced-motion: no-preference) {
  .preview-view__back {
    transition: opacity var(--transition-duration-normal) var(--transition-easing-ease-out);
  }
}

@media print {
  .preview-view__back {
    display: none;
  }
}
</style>
