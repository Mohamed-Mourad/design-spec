<script setup lang="ts">
// Recursive file-tree node: renders a file as a selectable button, or a folder
// with its children rendered by this same component (arbitrary depth).
import type { TreeNode } from '@/utils/fileTree'

defineProps<{
  node: TreeNode
  activePath: string
  depth?: number
}>()
const emit = defineEmits<{ select: [filename: string] }>()
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
    <span class="node__folder-label" :style="{ paddingLeft: `${8 + (depth ?? 0) * 12}px` }">
      {{ node.name }}/
    </span>
    <FileTreeNode
      v-for="child in node.children"
      :key="child.path"
      :node="child"
      :active-path="activePath"
      :depth="(depth ?? 0) + 1"
      @select="emit('select', $event)"
    />
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
  display: block;
  padding: 3px var(--spacing-sm);
  font-family: var(--font-mono);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-on-surface-subtle);
}
</style>
