<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'
import { isValidColorValue, isHexColor, normalizeHex, isTokenReference } from '@/utils/colorUtils'
import ColorPicker from '@/components/editors/ColorPicker.vue'

const props = defineProps<{
  tokenKey: string
  value: string
}>()
const emit = defineEmits<{
  update: [key: string, value: string]
  remove: [key: string]
}>()

const store = useDesignSystemStore()

const draft = ref(props.value)
watch(
  () => props.value,
  (v) => {
    draft.value = v
  },
)

// Resolve a {token} reference to a concrete color for the swatch + picker seed.
const resolved = computed(() => {
  if (!isTokenReference(props.value)) return props.value
  const path = props.value.slice(1, -1).split('.')
  let node: unknown = store.schema
  for (const seg of path) {
    if (node && typeof node === 'object') node = (node as Record<string, unknown>)[seg]
    else return '#000000'
  }
  return typeof node === 'string' ? node : '#000000'
})
const pickerSeed = computed(() => (isHexColor(resolved.value) ? resolved.value : '#000000'))

// ── Picker popover (teleported to body so it overlays the preview) ──
const open = ref(false)
const swatchEl = ref<HTMLElement | null>(null)
const popoverEl = ref<HTMLElement | null>(null)
const POP_W = 238
const POP_H = 300
const popStyle = ref<Record<string, string>>({})

function reposition() {
  const el = swatchEl.value
  if (!el) return
  const r = el.getBoundingClientRect()
  const left = Math.min(Math.max(8, r.left), window.innerWidth - POP_W - 8)
  const below = r.bottom + 4
  const top = below + POP_H > window.innerHeight ? Math.max(8, r.top - POP_H - 4) : below
  popStyle.value = { left: `${left}px`, top: `${top}px` }
}

watch(open, (isOpen) => {
  if (isOpen) {
    store.beginBatch() // coalesce the whole picker session into one undo step
    nextTick(reposition)
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
  } else {
    store.endBatch()
    window.removeEventListener('scroll', reposition, true)
    window.removeEventListener('resize', reposition)
  }
})

function onDocClick(e: MouseEvent) {
  const t = e.target as Node
  if (open.value && !swatchEl.value?.contains(t) && !popoverEl.value?.contains(t)) open.value = false
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') open.value = false
}
onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onKey)
})
onUnmounted(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKey)
  window.removeEventListener('scroll', reposition, true)
  window.removeEventListener('resize', reposition)
  if (open.value) store.endBatch()
})

function onPick(hex: string) {
  draft.value = hex
  emit('update', props.tokenKey, hex) // raw hex replaces a token ref
}

function commit() {
  const next = normalizeHex(draft.value)
  if (isValidColorValue(next)) {
    if (next !== props.value) emit('update', props.tokenKey, next)
  } else {
    draft.value = props.value // reset to last valid
  }
}
</script>

<template>
  <div class="row">
    <span class="row__key" :title="tokenKey">{{ tokenKey }}</span>

    <button
      ref="swatchEl"
      class="row__swatch"
      :style="{ background: resolved }"
      :title="resolved"
      :aria-label="`Edit ${tokenKey} color`"
      :aria-expanded="open"
      @click="open = !open"
    />

    <input
      v-model="draft"
      class="row__hex"
      :data-testid="`token-editor-color-${tokenKey}`"
      spellcheck="false"
      aria-label="Color value or token reference"
      @blur="commit"
      @keydown.enter="commit"
    />
    <button class="row__remove" :aria-label="`Remove ${tokenKey}`" @click="emit('remove', tokenKey)">×</button>

    <Teleport to="body">
      <div v-if="open" ref="popoverEl" class="row__popover" :style="popStyle">
        <ColorPicker :model-value="pickerSeed" @update:model-value="onPick" />
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.row {
  display: grid;
  grid-template-columns: 1fr auto 1fr auto;
  align-items: center;
  gap: var(--spacing-sm);
  padding: 4px 0;
}
.row__key {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--color-on-surface);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.row__swatch {
  width: 24px;
  height: 22px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-surface-border);
  cursor: pointer;
  padding: 0;
}
.row__hex {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--color-on-surface);
  background-color: var(--color-surface-sunken);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  padding: 3px 6px;
  width: 100%;
  min-width: 0;
}
.row__remove {
  background: none;
  border: none;
  color: var(--color-on-surface-subtle);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  padding: 0 4px;
}
.row__remove:hover {
  color: var(--color-status-error);
}
</style>

<style>
/* Teleported to body — not scoped. */
.row__popover {
  position: fixed;
  z-index: var(--z-modal);
}
</style>
