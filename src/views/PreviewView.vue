<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useHead } from '@unhead/vue'
import { ArrowLeft, Code2, FilePlus2, Globe, SlidersHorizontal, X } from '@lucide/vue'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'
import BentoPreview from '@/components/preview/bento/BentoPreview.vue'
import BentoLayoutEditor from '@/components/preview/BentoLayoutEditor.vue'
import ProposalBrandingEditor from '@/components/preview/ProposalBrandingEditor.vue'
import PublishProposalModal from '@/components/preview/PublishProposalModal.vue'
import EmbedCodeModal from '@/components/preview/EmbedCodeModal.vue'
import ShareLinkButton from '@/components/preview/ShareLinkButton.vue'
import { usePublishedSchema } from '@/composables/usePublishedSchema'
import { renderOgImage } from '@/utils/ogCanvas'
import { decodeSchemaHash } from '@/utils/shareLink'
import { apiConfigured, type Proposal } from '@/utils/api'
import type { DesignSystemSchema } from '@/types/schema'

const route = useRoute()
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

/**
 * The Pro short link, `/preview/{id}`. Same page, third source: a snapshot
 * stored server-side rather than one carried in the URL. A snapshot is
 * immutable, so like a hash link it is read-only here.
 */
const snapshotId = computed(() => (route.params.id ? String(route.params.id) : ''))
const snapshot = usePublishedSchema()

onMounted(() => {
  if (snapshotId.value) snapshot.loadSnapshot(snapshotId.value)
})

const isShared = computed(() => sharedSchema.value !== null || snapshot.schema.value !== null)
const schema = computed(() => sharedSchema.value ?? snapshot.schema.value ?? ownSchema.value)
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
  const incoming = sharedSchema.value ?? snapshot.schema.value
  if (!incoming) return
  store.createWorkspace(incoming.name)
  store.loadPreset(incoming)
  router.push('/workspace')
}

/**
 * The layout is edited here rather than in the workspace panels because this is
 * the only place its result is visible. A shared link is someone else's system,
 * so it is read-only — the viewer can copy it into a workspace and edit that.
 */
const customizing = ref(false)

/** Which drawer tab is showing: the layout, or the Pro branding fields. */
const drawerTab = ref<'layout' | 'branding'>('layout')

// ── Pro: publishing ──
const publishing = ref(false)
const embedding = ref(false)
const proposal = ref<Proposal | null>(null)

/** Publishing needs a backend; hash sharing deliberately does not. */
const canPublish = computed(() => !isShared.value && apiConfigured())

const embedUrl = computed(
  () => proposal.value?.embed_url ?? `${location.origin}/embed/${schema.value.presentation?.publicSlug ?? ''}`,
)

function onPublished(published: Proposal) {
  proposal.value = published
  // Remember the address on the schema so a later edit knows what to update
  // and the embed dialog has something to point at.
  store.updatePresentation({ publicSlug: published.slug })
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

      <button
        v-if="!isShared"
        class="preview-view__ghost"
        data-testid="customize-bento"
        :aria-expanded="customizing"
        title="Choose which cells show, how wide they are, and in what order"
        @click="customizing = !customizing"
      >
        <SlidersHorizontal :size="15" aria-hidden="true" />
        <span>Customize</span>
      </button>

      <button
        v-if="canPublish"
        class="preview-view__ghost"
        data-testid="open-publish"
        title="Publish this at a short public address with your branding"
        @click="publishing = true"
      >
        <Globe :size="15" aria-hidden="true" />
        <span>Publish</span>
      </button>

      <button
        v-if="proposal"
        class="preview-view__ghost"
        data-testid="open-embed"
        title="Get the embed code"
        @click="embedding = true"
      >
        <Code2 :size="15" aria-hidden="true" />
        <span>Embed</span>
      </button>

      <ShareLinkButton :schema="schema" />
    </div>

    <aside v-if="customizing && !isShared" class="preview-view__drawer">
      <header class="preview-view__drawer-head">
        <div class="preview-view__drawer-tabs" role="tablist" aria-label="Preview settings">
          <button
            v-for="tab in (['layout', 'branding'] as const)"
            :key="tab"
            class="preview-view__drawer-tab"
            :class="{ 'preview-view__drawer-tab--on': drawerTab === tab }"
            role="tab"
            :aria-selected="drawerTab === tab"
            @click="drawerTab = tab"
          >
            {{ tab === 'layout' ? 'Layout' : 'Branding' }}
          </button>
        </div>
        <button class="preview-view__ghost" aria-label="Close the settings panel" @click="customizing = false">
          <X :size="15" aria-hidden="true" />
        </button>
      </header>

      <BentoLayoutEditor
        v-if="drawerTab === 'layout'"
        :layout="schema.presentation?.bentoLayout"
        @update="store.updateBentoLayout($event)"
      />
      <ProposalBrandingEditor
        v-else
        :presentation="schema.presentation"
        @update="store.updatePresentation($event)"
      />
    </aside>

    <div v-if="publishing || embedding" class="preview-view__scrim" @click.self="publishing = embedding = false">
      <PublishProposalModal
        v-if="publishing"
        :schema="schema"
        @close="publishing = false"
        @published="onPublished"
      />
      <EmbedCodeModal
        v-else
        :embed-url="embedUrl"
        :allow-iframe="schema.presentation?.embedOptions?.allowIframe ?? true"
        @close="embedding = false"
      />
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

.preview-view__drawer {
  position: fixed;
  top: 64px;
  right: var(--spacing-md);
  bottom: var(--spacing-md);
  z-index: var(--z-dropdown);
  width: 340px;
  max-width: calc(100vw - var(--spacing-lg));
  overflow-y: auto;
  padding: var(--spacing-md);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-lg);
  background-color: var(--color-surface-default);
  box-shadow: var(--shadow-lg);
}

.preview-view__drawer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-md);
}

.preview-view__drawer-tabs {
  display: flex;
  gap: 4px;
}

.preview-view__drawer-tab {
  min-height: 30px;
  padding: 0 12px;
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  background: none;
  font-family: var(--font-sans);
  font-size: 12px;
  color: var(--color-on-surface-muted);
  cursor: pointer;
}

.preview-view__drawer-tab--on {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.preview-view__drawer-tab:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--color-interactive-focus-ring);
}

.preview-view__scrim {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-md);
  background-color: rgb(0 0 0 / 0.55);
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
