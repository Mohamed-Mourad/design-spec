<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useHead } from '@unhead/vue'
import { ArrowLeft, FilePlus2 } from '@lucide/vue'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'
import BentoPreview from '@/components/preview/bento/BentoPreview.vue'
import ShareLinkButton from '@/components/preview/ShareLinkButton.vue'
import { renderOgImage } from '@/utils/ogCanvas'
import { decodeSchemaHash } from '@/utils/shareLink'
import type { DesignSystemSchema } from '@/types/schema'

const router = useRouter()
const store = useDesignSystemStore()
const { schema: ownSchema } = storeToRefs(store)

/**
 * A schema carried in by `/preview#<hash>`. Reading it needs no account and no
 * network: the fragment never reaches a server, so a shared link works even
 * against a build with no API configured at all.
 */
const sharedSchema = ref<DesignSystemSchema | null>(null)
const hashRejected = ref(false)

function readHash() {
  const raw = typeof location === 'undefined' ? '' : location.hash
  if (!raw || raw === '#') {
    sharedSchema.value = null
    hashRejected.value = false
    return
  }
  const decoded = decodeSchemaHash(raw)
  sharedSchema.value = decoded
  hashRejected.value = decoded === null
}

readHash()
onMounted(() => window.addEventListener('hashchange', readHash))

const isShared = computed(() => sharedSchema.value !== null)
const schema = computed(() => sharedSchema.value ?? ownSchema.value)
const branding = computed(() => schema.value.presentation?.proposalBranding)

/**
 * The card is drawn once the fonts are ready, so it lands a tick after mount.
 * `og:image` simply carries no value until then — an empty tag beats a data URL
 * of a card rendered in the fallback serif.
 */
const ogImage = ref<string | null>(null)

async function paintOgImage() {
  ogImage.value = await renderOgImage(schema.value, { branding: branding.value })
}

onMounted(paintOgImage)
watch(() => [schema.value.name, isShared.value], paintOgImage)

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

/**
 * Copy a shared system into a workspace of its own. Never into the active one:
 * whoever opened the link may well have their own unsaved work sitting there.
 */
function openInWorkspace() {
  const incoming = sharedSchema.value
  if (!incoming) return
  store.createWorkspace(incoming.name)
  store.loadPreset(incoming)
  router.push('/workspace')
}
</script>

<template>
  <div class="preview-view">
    <!--
      Full-bleed by design: the bento is the page, not a panel inside one. The
      only chrome is a floating control cluster that gets out of the way, so a
      screenshot of this route is a screenshot of the design system.
    -->
    <div class="preview-view__chrome">
      <button
        v-if="!isShared"
        class="preview-view__ghost"
        title="Back to the workspace"
        @click="router.back()"
      >
        <ArrowLeft :size="15" aria-hidden="true" />
        <span>Back</span>
      </button>

      <button
        v-else
        class="preview-view__ghost"
        data-testid="open-in-workspace"
        title="Copy this system into a workspace of your own"
        @click="openInWorkspace"
      >
        <FilePlus2 :size="15" aria-hidden="true" />
        <span>Open in workspace</span>
      </button>

      <ShareLinkButton :schema="schema" />
    </div>

    <p v-if="hashRejected" class="preview-view__notice" data-testid="bad-share-link">
      That share link is damaged or incomplete, so this is your own workspace instead.
    </p>

    <BentoPreview :schema="schema" :branding="branding" />
  </div>
</template>

<style scoped>
.preview-view {
  position: relative;
  min-height: 100dvh;
  background-color: var(--color-surface-page);
}

.preview-view__chrome {
  position: fixed;
  top: var(--spacing-md);
  right: var(--spacing-md);
  z-index: var(--z-sticky);
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  opacity: 0.55;
}

.preview-view__chrome:hover,
.preview-view__chrome:focus-within {
  opacity: 1;
}

.preview-view__ghost {
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
}

.preview-view__ghost:hover {
  color: var(--color-on-surface);
}

.preview-view__ghost:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--color-interactive-focus-ring);
}

.preview-view__notice {
  margin: 0;
  padding: var(--spacing-sm) var(--spacing-lg);
  background-color: var(--color-surface-raised);
  border-bottom: 1px solid var(--color-status-warning);
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--color-on-surface-muted);
}

@media (prefers-reduced-motion: no-preference) {
  .preview-view__chrome {
    transition: opacity var(--transition-duration-normal) var(--transition-easing-ease-out);
  }
}

@media print {
  .preview-view__chrome {
    display: none;
  }
}
</style>
