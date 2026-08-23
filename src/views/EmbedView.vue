<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import BentoPreview from '@/components/preview/bento/BentoPreview.vue'
import { usePublishedSchema } from '@/composables/usePublishedSchema'
import { frameVerdict, type FrameVerdict } from '@/utils/framing'

// The iframe target: /embed/{slug}. Two callers, and they want opposite things.
//
//   - somebody's Notion page, framing this and expecting it to just render
//   - the backend's headless browser, opening it top-level with ?og=1 to
//     screenshot it for the social card
//
// Both get the same bento. Only the second one waits to be told the page has
// settled, and only the first one is subject to the framing check.

const route = useRoute()
const { schema, loading, error, loadProposal } = usePublishedSchema()

const slug = computed(() => String(route.params.slug ?? ''))
const isOgCapture = computed(() => route.query.og === '1')
const branding = computed(() => schema.value?.presentation?.proposalBranding)
const embedOptions = computed(() => schema.value?.presentation?.embedOptions)

const verdict = ref<FrameVerdict>('top-level')
/** Screenshot cue for the renderer — see internal/service/ogrender.go. */
const ogReady = ref(false)

onMounted(async () => {
  await loadProposal(slug.value)
  verdict.value = frameVerdict({
    allowIframe: embedOptions.value?.allowIframe ?? true,
    allowedOrigins: embedOptions.value?.allowedOrigins,
  })
})

const blocked = computed(
  () => verdict.value === 'blocked-by-policy' || verdict.value === 'blocked-by-origin',
)
const renderable = computed(() => !!schema.value && !blocked.value)

/**
 * Signal readiness only once the fonts have resolved and the bento has
 * painted. Without the font wait the screenshot catches the fallback serif
 * mid-swap, which is exactly the artifact the card exists to avoid.
 */
watch(renderable, async (ready) => {
  if (!ready) return
  await nextTick()
  try {
    await document.fonts?.ready
  } catch {
    /* no font loading API — the paint above is the best cue available */
  }
  ogReady.value = true
})
</script>

<template>
  <div
    class="embed-view"
    :class="{ 'embed-view--og': isOgCapture }"
    :data-og-ready="ogReady ? 'true' : 'false'"
    data-testid="embed-view"
  >
    <p v-if="loading" class="embed-view__state">Loading…</p>

    <p v-else-if="blocked" class="embed-view__state" data-testid="embed-blocked">
      {{
        verdict === 'blocked-by-policy'
          ? 'This design system is not available for embedding.'
          : 'This design system is not embeddable on this site.'
      }}
    </p>

    <p v-else-if="error" class="embed-view__state" data-testid="embed-error">{{ error }}</p>

    <BentoPreview v-else-if="schema" :schema="schema" :branding="branding" />
  </div>
</template>

<style scoped>
.embed-view {
  min-height: 100dvh;
  background-color: var(--color-surface-page);
}

/*
 * The capture viewport is a fixed 1200×630. Anything taller than that is
 * cropped by the screenshot, so the card shows the top of the bento — the
 * identity and palette — rather than a squeezed whole.
 */
.embed-view--og {
  overflow: hidden;
  height: 630px;
  min-height: 630px;
}

.embed-view__state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 240px;
  margin: 0;
  padding: var(--spacing-lg);
  font-family: var(--font-sans);
  font-size: 14px;
  text-align: center;
  color: var(--color-on-surface-muted);
}
</style>
