<script setup lang="ts">
import { computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'
import { useHighlighter } from '@/composables/useHighlighter'
import type { FileOutput } from '@/types/compiler'

const store = useDesignSystemStore()
const { outputFiles, activePreviewFile } = storeToRefs(store)
const { ready, highlight } = useHighlighter()

// Build a folder/file tree from the flat FileOutput[] (filenames may contain '/').
interface TreeNode {
  name: string
  path: string
  children: TreeNode[]
  file?: FileOutput
}

function buildTree(files: FileOutput[]): TreeNode[] {
  const root: TreeNode = { name: '', path: '', children: [] }
  for (const file of files) {
    const parts = file.filename.split('/')
    let node = root
    parts.forEach((part, i) => {
      const isLeaf = i === parts.length - 1
      let child = node.children.find((c) => c.name === part)
      if (!child) {
        child = { name: part, path: parts.slice(0, i + 1).join('/'), children: [] }
        node.children.push(child)
      }
      if (isLeaf) child.file = file
      node = child
    })
  }
  const sort = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => Number(!!a.file) - Number(!!b.file) || a.name.localeCompare(b.name))
    nodes.forEach((n) => sort(n.children))
  }
  sort(root.children)
  return root.children
}

const tree = computed(() => buildTree(outputFiles.value))
const activeFile = computed(
  () => outputFiles.value.find((f) => f.filename === activePreviewFile.value) ?? outputFiles.value[0],
)

// Keep the selection valid as frameworks toggle files in/out.
watch(outputFiles, (files) => {
  if (!files.some((f) => f.filename === activePreviewFile.value)) {
    activePreviewFile.value = files[0]?.filename ?? 'DESIGN.md'
  }
})

const highlighted = computed(() =>
  ready.value && activeFile.value ? highlight(activeFile.value.content, activeFile.value.language) : null,
)
</script>

<template>
  <div class="fp">
    <nav class="fp__tree" aria-label="Generated files">
      <template v-for="node in tree" :key="node.path">
        <button
          v-if="node.file"
          class="fp__file"
          :class="{ 'fp__file--active': activePreviewFile === node.file.filename }"
          @click="activePreviewFile = node.file.filename"
        >
          {{ node.name }}
        </button>
        <div v-else class="fp__folder">
          <span class="fp__folder-label">{{ node.name }}/</span>
          <button
            v-for="child in node.children"
            :key="child.path"
            class="fp__file fp__file--nested"
            :class="{ 'fp__file--active': child.file && activePreviewFile === child.file.filename }"
            @click="child.file && (activePreviewFile = child.file.filename)"
          >
            {{ child.name }}
          </button>
        </div>
      </template>
    </nav>

    <div class="fp__content">
      <div v-if="highlighted" class="fp__code" v-html="highlighted" />
      <pre v-else class="fp__code fp__code--plain">{{ activeFile?.content }}</pre>
    </div>
  </div>
</template>

<style scoped>
.fp {
  display: grid;
  grid-template-rows: auto 1fr;
  min-height: 0;
  height: 100%;
}
.fp__tree {
  display: flex;
  flex-direction: column;
  gap: 1px;
  max-height: 180px;
  overflow-y: auto;
  padding: var(--spacing-xs);
  border-bottom: 1px solid var(--color-surface-border);
}
.fp__file {
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
.fp__file--nested {
  padding-left: var(--spacing-md);
}
.fp__file:hover {
  color: var(--color-on-surface);
  background-color: var(--color-surface-raised);
}
.fp__file--active {
  color: var(--color-on-surface);
  background-color: var(--color-surface-raised);
}
.fp__folder-label {
  display: block;
  padding: 3px var(--spacing-sm);
  font-family: var(--font-mono);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-on-surface-subtle);
}
.fp__content {
  overflow: auto;
  min-height: 0;
}
.fp__code {
  margin: 0;
  padding: var(--spacing-md);
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.6;
}
.fp__code--plain {
  color: var(--color-on-surface-muted);
  white-space: pre-wrap;
  word-break: break-word;
}
/* Shiki emits its own <pre class="shiki">; let it own the background. */
.fp__code :deep(pre.shiki) {
  margin: 0;
  padding: 0;
  background: transparent !important;
  white-space: pre;
}
</style>
