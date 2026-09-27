<script setup lang="ts">
import { computed } from 'vue'
import { FolderOpen } from '@lucide/vue'
import { usePreviewKit, type PreviewProps } from './usePreviewKit'

const props = defineProps<PreviewProps>()
const { group, groupStyle, propDefault } = usePreviewKit()

const iconSize = computed(() => parseInt(String(group(props.name, 'icon')?.size ?? '')) || 40)
</script>

<template>
  <div class="es" :data-testid="testid" :style="rootStyle">
    <FolderOpen :size="iconSize" :style="groupStyle(name, 'icon')" class="es__icon" aria-hidden="true" />
    <h4 class="es__title" :style="groupStyle(name, 'title')">{{ propDefault(name, 'title', 'No projects yet') }}</h4>
    <p class="es__desc" :style="groupStyle(name, 'description')">{{ propDefault(name, 'description', 'Create your first project to get started.') }}</p>
    <button type="button" class="es__action" :style="groupStyle(name, 'action')">{{ propDefault(name, 'actionLabel', 'New project') }}</button>
  </div>
</template>

<style scoped>
.es {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
  text-align: center;
  width: 22rem;
  max-width: 100%;
  box-sizing: border-box;
}
.es__title,
.es__desc {
  margin: 0;
}
.es__action {
  margin-top: var(--spacing-xs);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  border: 0;
  cursor: pointer;
}
.es__action:focus-visible {
  outline: 2px solid var(--color-interactive-focus-ring);
  outline-offset: 2px;
}
</style>
