<script setup lang="ts">
// Recursive file-tree node: renders a file as a selectable button, or a
// collapsible folder whose children are rendered by this same component.
import { ref } from 'vue'
import type { TreeNode } from '@/utils/fileTree'

defineProps<{
  node: TreeNode
  activePath: string
  depth?: number
}>()
const emit = defineEmits<{ select: [filename: string] }>()

const open = ref(true)
</script>

<template>
  <button
    v-if="node.file"
    class="node node--file"
    :class="{ 'node--active': activePath === node.file.filename }"
    :style="{ paddingLeft: `${8 + (depth ?? 0) * 12}px` }"
    @click="emit('select', node.file.filename)"
  >
    {{ node.name }}
  </button>
  <div v-else class="node node--folder">
    <button
      class="node__folder-label"
      :style="{ paddingLeft: `${8 + (depth ?? 0) * 12}px` }"
      :aria-expanded="open"
      @click="open = !open"
    >
      <span class="node__caret" :class="{ 'node__caret--open': open }">▸</span>
      {{ node.name }}/
    </button>
    <template v-if="open">
      <FileTreeNode
        v-for="child in node.children"
        :key="child.path"
        :node="child"
        :active-path="activePath"
        :depth="(depth ?? 0) + 1"
        @select="emit('select', $event)"
      />
    </template>
  </div>
</template>

<style scoped>
.node--file {
  display: block;
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  padding: 3px var(--spacing-sm);
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-on-surface-muted);
  cursor: pointer;
}
.node--file:hover,
.node--active {
  color: var(--color-on-surface);
  background-color: var(--color-surface-raised);
}
.node__folder-label {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  cursor: pointer;
  padding: 3px var(--spacing-sm);
  font-family: var(--font-mono);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-on-surface-subtle);
}
.node__folder-label:hover {
  color: var(--color-on-surface-muted);
}
.node__caret {
  display: inline-block;
  font-size: 9px;
  transition: transform var(--transition-duration-fast) var(--transition-easing-ease-out);
}
.node__caret--open {
  transform: rotate(90deg);
}
</style>
