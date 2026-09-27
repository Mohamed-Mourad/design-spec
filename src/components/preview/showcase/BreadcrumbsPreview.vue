<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronRight } from '@lucide/vue'
import { usePreviewKit, type PreviewProps } from './usePreviewKit'

const props = defineProps<PreviewProps>()
const { groupStyle, layoutReached, propDefault } = usePreviewKit()

const TRAIL = ['Home', 'Projects', 'Design Spec', 'Tokens']
const expanded = ref(false)

// Below the layout breakpoint the middle crumbs collapse to an ellipsis.
const collapsed = computed(() => !layoutReached(props.name) && !expanded.value)
const items = computed(() => (collapsed.value ? [TRAIL[0], TRAIL[TRAIL.length - 1]] : TRAIL))
const separator = computed(() => propDefault<string>(props.name, 'separator', 'chevron'))
const SEP_TEXT: Record<string, string> = { slash: '/', dot: '·' }
</script>

<template>
  <nav aria-label="Breadcrumb" class="bc" :data-testid="testid" :style="rootStyle">
    <ol class="bc__list">
      <template v-for="(item, i) in items" :key="item">
        <li v-if="i > 0" class="bc__sep" :style="groupStyle(name, 'separator')" aria-hidden="true">
          <ChevronRight v-if="separator === 'chevron'" :size="14" />
          <template v-else>{{ SEP_TEXT[separator] ?? '/' }}</template>
        </li>
        <template v-if="collapsed && i === 1">
          <li>
            <button type="button" class="bc__more" :aria-label="`Show ${TRAIL.length - 2} more`" @click="expanded = true">…</button>
          </li>
          <li class="bc__sep" :style="groupStyle(name, 'separator')" aria-hidden="true">
            <ChevronRight v-if="separator === 'chevron'" :size="14" />
            <template v-else>{{ SEP_TEXT[separator] ?? '/' }}</template>
          </li>
        </template>
        <li>
          <span v-if="i === items.length - 1" aria-current="page" :style="groupStyle(name, 'current')">{{ item }}</span>
          <a v-else href="#" class="bc__link" :style="groupStyle(name, 'link')" @click.prevent>{{ item }}</a>
        </li>
      </template>
    </ol>
  </nav>
</template>

<style scoped>
.bc {
  max-width: 100%;
}
.bc__list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-xs);
  margin: 0;
  padding: 0;
  list-style: none;
}
.bc__sep {
  display: inline-flex;
  align-items: center;
}
.bc__link {
  text-decoration: none;
}
.bc__link:hover {
  text-decoration: underline;
}
.bc__more {
  font: inherit;
  color: inherit;
  background: none;
  border: 0;
  padding: 0 var(--spacing-xs);
  cursor: pointer;
}
.bc__link:focus-visible,
.bc__more:focus-visible {
  outline: 2px solid var(--color-interactive-focus-ring);
  outline-offset: 2px;
}
</style>
