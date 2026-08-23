<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { CSSProperties } from 'vue'
import { resolveComponentStyle } from '@/utils/previewStyle'
import type { DesignSystemSchema } from '@/types/schema'

const props = withDefaults(
  defineProps<{
    schema: DesignSystemSchema
    /** Blueprint to render — 'Button' | 'Input' | 'Card' | 'Badge'. */
    blueprint: string
    /** Thumbnail factor. Components render at real size, then scale down. */
    scale?: number
    /** Cap on variants shown, so a system with a dozen doesn't crowd the tile. */
    limit?: number
  }>(),
  { scale: 1, limit: 4 },
)

interface VariantRender {
  variant: string
  style: CSSProperties
}

const blueprint = computed(() => props.schema.componentBlueprints[props.blueprint])

const variants = computed<VariantRender[]>(() => {
  const bp = blueprint.value
  if (!bp) return []
  const names = bp.variants.length ? bp.variants : ['default']
  return names.slice(0, props.limit).map((variant) => ({
    variant,
    style: resolveComponentStyle(
      props.schema,
      bp,
      Number.POSITIVE_INFINITY,
      bp.variants.length ? variant : undefined,
    ).style,
  }))
})

// A CSS transform doesn't shrink the box it's applied to, so the scaled content
// would leave the tile's original height as dead space. Mirror the scaled
// height onto the wrapper instead of guessing a fixed one — a Card variant and
// a Badge variant differ by an order of magnitude.
const inner = ref<HTMLElement | null>(null)
const scaledHeight = ref<number | null>(null)
let observer: ResizeObserver | null = null

function measure() {
  if (inner.value) scaledHeight.value = inner.value.offsetHeight * props.scale
}

onMounted(() => {
  if (typeof ResizeObserver === 'undefined') return
  observer = new ResizeObserver(measure)
  if (inner.value) observer.observe(inner.value)
  measure()
})

onBeforeUnmount(() => observer?.disconnect())
watch(() => props.scale, measure)

const wrapperStyle = computed<CSSProperties>(() =>
  scaledHeight.value === null ? {} : { height: `${scaledHeight.value}px` },
)

const innerStyle = computed<CSSProperties>(() => ({
  width: `${100 / props.scale}%`,
  transform: `scale(${props.scale})`,
  transformOrigin: 'top left',
}))
</script>

<template>
  <div class="cc" :style="wrapperStyle">
    <div ref="inner" class="cc__inner" :style="innerStyle">
      <div v-for="v in variants" :key="v.variant" class="cc__variant">
        <button v-if="blueprint?.name === 'Button'" type="button" :style="v.style" :data-bento-variant="v.variant">
          {{ v.variant === 'default' ? blueprint.name : v.variant }}
        </button>

        <input
          v-else-if="blueprint?.name === 'Input'"
          :style="v.style"
          :data-bento-variant="v.variant"
          placeholder="Placeholder"
          readonly
        />

        <span v-else-if="blueprint?.name === 'Badge'" :style="v.style" :data-bento-variant="v.variant">
          {{ v.variant === 'default' ? blueprint.name : v.variant }}
        </span>

        <div v-else class="cc__card" :style="v.style" :data-bento-variant="v.variant">
          <strong>{{ v.variant === 'default' ? blueprint?.name : v.variant }}</strong>
          <span>Grouped content lives here.</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cc {
  overflow: hidden;
}

.cc__inner {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 10px;
}

.cc__variant {
  display: flex;
  min-width: 0;
}

.cc__variant > button,
.cc__variant > span,
.cc__variant > input {
  border: 0 solid transparent;
  font-family: inherit;
  line-height: 1.2;
}

.cc__variant > button {
  cursor: default;
}

.cc__card {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 168px;
  font-family: var(--font-sans);
  font-size: 12px;
}
</style>
