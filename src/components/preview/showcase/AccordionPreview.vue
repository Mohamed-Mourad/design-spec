<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import type { CSSProperties } from 'vue'
import { ChevronDown } from '@lucide/vue'
import { usePreviewKit, type PreviewProps } from './usePreviewKit'

const props = defineProps<PreviewProps>()
const { schema, groupVal, groupStyle, propDefault } = usePreviewKit()

const ITEMS = [
  { title: 'What are design tokens?', body: 'Named values — colors, spacing, type — that every surface reads.' },
  { title: 'Can I export to Flutter?', body: 'Yes. Pick the Flutter stack and the Dart theme is generated.' },
  { title: 'Does it work offline?', body: 'The workspace keeps everything in your browser.' },
]
const uid = useId()
const openSet = ref<Set<number>>(new Set([0]))
const multiple = computed(() => propDefault<string>(props.name, 'type', 'single') === 'multiple')

function toggle(i: number) {
  const next = new Set(multiple.value ? openSet.value : openSet.value.has(i) ? [i] : [])
  if (next.has(i)) next.delete(i)
  else next.add(i)
  openSet.value = next
}

const dividerStyle = computed<CSSProperties>(() => ({
  borderTop: `${groupVal(props.name, 'divider', 'borderWidth', '1px')} solid ${groupVal(props.name, 'divider', 'borderColor', 'currentColor')}`,
}))
// Motion follows the schema's own timing token (and its reduced-motion switch).
const motionStyle = computed<CSSProperties>(() => ({
  '--acc-duration': schema.value.transitions.reducedMotion ? '0ms' : String(schema.value.transitions.duration.normal ?? '200ms'),
}) as CSSProperties)
</script>

<template>
  <div class="acc" :data-testid="testid" :style="[rootStyle, motionStyle]">
    <div v-for="(item, i) in ITEMS" :key="item.title" class="acc__item" :style="i > 0 ? dividerStyle : undefined">
      <h3 class="acc__heading">
        <button
          :id="`${uid}-trigger-${i}`"
          type="button"
          class="acc__trigger"
          :aria-expanded="openSet.has(i)"
          :aria-controls="`${uid}-panel-${i}`"
          :style="groupStyle(name, 'trigger')"
          @click="toggle(i)"
        >
          <span>{{ item.title }}</span>
          <ChevronDown class="acc__chevron" :class="{ 'acc__chevron--open': openSet.has(i) }" :size="16" aria-hidden="true" />
        </button>
      </h3>
      <Transition name="acc">
        <div
          v-show="openSet.has(i)"
          :id="`${uid}-panel-${i}`"
          role="region"
          class="acc__panel"
          :aria-labelledby="`${uid}-trigger-${i}`"
          :style="groupStyle(name, 'content')"
        >
          {{ item.body }}
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.acc {
  width: 22rem;
  max-width: 100%;
  box-sizing: border-box;
  overflow: hidden;
}
.acc__heading {
  margin: 0;
  font: inherit;
}
.acc__trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
  width: 100%;
  background: none;
  border: 0;
  cursor: pointer;
  text-align: left;
}
.acc__trigger:focus-visible {
  outline: 2px solid var(--color-interactive-focus-ring);
  outline-offset: -2px;
}
.acc__chevron {
  flex-shrink: 0;
}
.acc__chevron--open {
  transform: rotate(180deg);
}
@media (prefers-reduced-motion: no-preference) {
  .acc__chevron {
    transition: transform var(--acc-duration, 200ms) ease-out;
  }
  .acc-enter-active,
  .acc-leave-active {
    transition:
      opacity var(--acc-duration, 200ms) ease-out,
      transform var(--acc-duration, 200ms) ease-out;
  }
  .acc-enter-from,
  .acc-leave-to {
    opacity: 0;
    transform: translateY(-4px);
  }
}
</style>
