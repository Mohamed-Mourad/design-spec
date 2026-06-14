<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'
import type { ComponentBlueprint } from '@/types/schema'
import { resolveComponentStyle } from '@/utils/previewStyle'

const store = useDesignSystemStore()
const { schema, viewportWidth } = storeToRefs(store)

interface Rendered {
  name: string
  category: string
  style: ReturnType<typeof resolveComponentStyle>['style']
  hidden: boolean
}

const rendered = computed<Rendered[]>(() =>
  Object.values(schema.value.componentBlueprints).map((bp: ComponentBlueprint) => {
    const { style, hidden } = resolveComponentStyle(schema.value, bp, viewportWidth.value)
    return { name: bp.name, category: bp.category, style, hidden }
  }),
)
</script>

<template>
  <div class="showcase">
    <div v-for="c in rendered" :key="c.name" class="showcase__cell">
      <span class="showcase__label">{{ c.name }}</span>

      <template v-if="!c.hidden">
        <button v-if="c.name === 'Button'" :data-testid="`preview-${c.name}`" :style="c.style">
          {{ c.name }}
        </button>

        <input
          v-else-if="c.name === 'Input'"
          :data-testid="`preview-${c.name}`"
          :style="c.style"
          placeholder="Placeholder"
        />

        <span v-else-if="c.name === 'Badge'" :data-testid="`preview-${c.name}`" :style="c.style">Badge</span>

        <div v-else-if="c.name === 'Card'" :data-testid="`preview-${c.name}`" :style="c.style">
          <strong>Card title</strong>
          <p class="showcase__card-body">Grouped content lives here.</p>
        </div>

        <div v-else-if="c.name === 'Alert'" :data-testid="`preview-${c.name}`" :style="c.style">
          Heads up — this is an alert.
        </div>

        <label
          v-else-if="c.name === 'Checkbox'"
          class="showcase__checkbox-row"
          :data-testid="`preview-${c.name}`"
        >
          <span class="showcase__checkbox" :style="c.style" />
          Label
        </label>

        <span v-else-if="c.name === 'Tooltip'" :data-testid="`preview-${c.name}`" :style="c.style">Tooltip</span>

        <div v-else :data-testid="`preview-${c.name}`" :style="c.style">{{ c.name }}</div>
      </template>

      <span v-else class="showcase__hidden">hidden at this viewport</span>
    </div>
  </div>
</template>

<style scoped>
.showcase {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: var(--spacing-lg);
  align-items: start;
}
.showcase__cell {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  align-items: flex-start;
}
.showcase__label {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-on-surface-subtle);
}
.showcase__card-body {
  margin: var(--spacing-xs) 0 0;
  font-size: 13px;
  opacity: 0.8;
}
.showcase__checkbox-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}
.showcase__checkbox {
  display: inline-block;
}
.showcase__hidden {
  font-family: var(--font-sans);
  font-size: 11px;
  font-style: italic;
  color: var(--color-on-surface-subtle);
}
button[data-testid],
input[data-testid] {
  cursor: pointer;
  border: 0;
}
</style>
