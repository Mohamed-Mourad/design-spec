<script setup lang="ts">
import { computed } from 'vue'
import type { Component } from 'vue'
import { FileQuestion, ServerCrash, Lock } from '@lucide/vue'
import { usePreviewKit, type PreviewProps } from './usePreviewKit'

const props = defineProps<PreviewProps>()
const { group, groupStyle, propDefault } = usePreviewKit()

interface Copy {
  code: string
  icon: Component
  title: string
  body: string
}
const COPY: Record<string, Copy> = {
  'not-found': { code: '404', icon: FileQuestion, title: 'Page not found', body: 'The page you are looking for moved or never existed.' },
  'server-error': { code: '500', icon: ServerCrash, title: 'Something went wrong', body: 'We could not load this page. Try again in a moment.' },
  forbidden: { code: '403', icon: Lock, title: 'No access', body: 'Ask a workspace owner to give you access.' },
}
const copy = computed(() => COPY[props.variant] ?? COPY['not-found'])
const iconSize = computed(() => parseInt(String(group(props.name, 'icon')?.size ?? '')) || 32)
</script>

<template>
  <div class="er" :data-testid="testid" :style="rootStyle">
    <span class="er__code" :style="groupStyle(name, 'code')">{{ copy.code }}</span>
    <component :is="copy.icon" :size="iconSize" :style="groupStyle(name, 'icon')" aria-hidden="true" />
    <h4 class="er__title" :style="groupStyle(name, 'title')">{{ copy.title }}</h4>
    <p class="er__desc" :style="groupStyle(name, 'description')">{{ copy.body }}</p>
    <button type="button" class="er__action" :style="groupStyle(name, 'action')">{{ propDefault(name, 'actionLabel', 'Go home') }}</button>
  </div>
</template>

<style scoped>
.er {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
  text-align: center;
  width: 16rem;
  max-width: 100%;
  box-sizing: border-box;
}
.er__title,
.er__desc {
  margin: 0;
}
.er__action {
  margin-top: var(--spacing-xs);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  border: 0;
  cursor: pointer;
}
.er__action:focus-visible {
  outline: 2px solid var(--color-interactive-focus-ring);
  outline-offset: 2px;
}
</style>
