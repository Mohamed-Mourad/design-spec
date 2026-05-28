<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'
import AppHeader from '@/components/layout/AppHeader.vue'
import LeftPanel from '@/components/layout/LeftPanel.vue'
import CenterPanel from '@/components/layout/CenterPanel.vue'
import RightPanel from '@/components/layout/RightPanel.vue'

const store = useDesignSystemStore()

function handleKeydown(e: KeyboardEvent) {
  const mod = e.ctrlKey || e.metaKey
  if (mod && e.key === 'z' && !e.shiftKey) {
    e.preventDefault()
    store.undo()
  } else if (mod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
    e.preventDefault()
    store.redo()
  }
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onUnmounted(() => window.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <div class="workspace">
    <AppHeader />
    <div class="workspace__body">
      <LeftPanel />
      <CenterPanel />
      <RightPanel />
    </div>
  </div>
</template>

<style scoped>
.workspace {
  display: grid;
  grid-template-rows: 48px 1fr;
  height: 100dvh;
  overflow: hidden;
  background-color: var(--color-surface-page);
}

.workspace__body {
  display: grid;
  grid-template-columns: 350px 1fr 420px;
  overflow: hidden;
  min-height: 0;
}
</style>
