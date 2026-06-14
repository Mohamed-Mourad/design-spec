<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const props = defineProps<{
  tokenKey: string
  value: string
}>()
const emit = defineEmits<{
  update: [key: string, value: string]
  remove: [key: string]
}>()

const presets: Record<string, string> = {
  linear: 'linear',
  'ease-out': 'cubic-bezier(0, 0, 0.2, 1)',
  'ease-in': 'cubic-bezier(0.4, 0, 1, 1)',
  'ease-in-out': 'cubic-bezier(0.4, 0, 0.2, 1)',
  spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
}

const draft = ref(props.value)
watch(
  () => props.value,
  (v) => (draft.value = v),
)

// Tick a key so the preview dot replays its transition on each change.
const replay = ref(0)
const animClass = computed(() => `ease-dot--run-${replay.value % 2}`)

function commit() {
  if (draft.value.trim() && draft.value !== props.value) emit('update', props.tokenKey, draft.value.trim())
  replay.value++
}
function applyPreset(name: string) {
  draft.value = presets[name]
  commit()
}
</script>

<template>
  <div class="ease">
    <div class="ease__head">
      <span class="ease__key">{{ tokenKey }}</span>
      <button class="ease__remove" :aria-label="`Remove ${tokenKey}`" @click="emit('remove', tokenKey)">×</button>
    </div>
    <div class="ease__track">
      <span :key="animClass" class="ease__dot" :style="{ transitionTimingFunction: draft }" />
    </div>
    <input
      v-model="draft"
      class="ease__input"
      spellcheck="false"
      :aria-label="`${tokenKey} curve`"
      @blur="commit"
      @keydown.enter="commit"
    />
    <div class="ease__presets">
      <button v-for="(_, name) in presets" :key="name" class="ease__preset" @click="applyPreset(name)">
        {{ name }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.ease {
  border: 1px solid var(--color-surface-border-subtle);
  border-radius: var(--radius-md);
  padding: var(--spacing-sm);
  margin-bottom: var(--spacing-sm);
  background-color: var(--color-surface-default);
}
.ease__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.ease__key {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--color-on-surface);
}
.ease__remove {
  background: none;
  border: none;
  color: var(--color-on-surface-subtle);
  font-size: 16px;
  cursor: pointer;
}
.ease__track {
  position: relative;
  height: 16px;
  margin: var(--spacing-sm) 0;
}
.ease__dot {
  position: absolute;
  top: 2px;
  width: 12px;
  height: 12px;
  border-radius: var(--radius-full);
  background-color: var(--color-primary);
  animation: ease-move 1.4s infinite alternate;
}
@keyframes ease-move {
  from {
    left: 0;
  }
  to {
    left: calc(100% - 12px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .ease__dot {
    animation: none;
  }
}
.ease__input {
  width: 100%;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-on-surface);
  background-color: var(--color-surface-sunken);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  padding: 3px 6px;
}
.ease__presets {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: var(--spacing-xs);
}
.ease__preset {
  font-family: var(--font-sans);
  font-size: 10px;
  color: var(--color-on-surface-muted);
  background-color: var(--color-surface-raised);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  padding: 2px 6px;
  cursor: pointer;
}
.ease__preset:hover {
  color: var(--color-on-surface);
}
</style>
