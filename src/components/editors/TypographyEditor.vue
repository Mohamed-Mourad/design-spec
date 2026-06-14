<script setup lang="ts">
import { reactive, watch } from 'vue'
import type { TypographyToken } from '@/types/schema'

const props = defineProps<{
  tokenKey: string
  value: TypographyToken
}>()
const emit = defineEmits<{
  update: [key: string, value: TypographyToken]
  remove: [key: string]
}>()

const draft = reactive<TypographyToken>({ ...props.value })
watch(
  () => props.value,
  (v) => Object.assign(draft, v),
  { deep: true },
)

const weights = [100, 200, 300, 400, 500, 600, 700, 800, 900]
const transforms = ['none', 'uppercase', 'lowercase', 'capitalize'] as const

function commit() {
  emit('update', props.tokenKey, { ...draft })
}
</script>

<template>
  <div class="ty">
    <div class="ty__head">
      <span class="ty__key">{{ tokenKey }}</span>
      <button class="ty__remove" :aria-label="`Remove ${tokenKey}`" @click="emit('remove', tokenKey)">×</button>
    </div>

    <p
      class="ty__sample"
      :style="{
        fontFamily: draft.fontFamily,
        fontSize: String(draft.fontSize),
        fontWeight: draft.fontWeight,
        lineHeight: String(draft.lineHeight),
        letterSpacing: draft.letterSpacing,
        textTransform: draft.textTransform,
      }"
    >
      The quick brown fox
    </p>

    <div class="ty__grid">
      <label class="ty__field">
        <span>family</span>
        <input v-model="draft.fontFamily" spellcheck="false" @blur="commit" @keydown.enter="commit" />
      </label>
      <label class="ty__field">
        <span>size</span>
        <input v-model="draft.fontSize" @blur="commit" @keydown.enter="commit" />
      </label>
      <label class="ty__field">
        <span>weight</span>
        <select v-model.number="draft.fontWeight" @change="commit">
          <option v-for="w in weights" :key="w" :value="w">{{ w }}</option>
        </select>
      </label>
      <label class="ty__field">
        <span>line-height</span>
        <input v-model="draft.lineHeight" @blur="commit" @keydown.enter="commit" />
      </label>
      <label class="ty__field">
        <span>tracking</span>
        <input v-model="draft.letterSpacing" placeholder="0" @blur="commit" @keydown.enter="commit" />
      </label>
      <label class="ty__field">
        <span>transform</span>
        <select v-model="draft.textTransform" @change="commit">
          <option v-for="t in transforms" :key="t" :value="t">{{ t }}</option>
        </select>
      </label>
    </div>
  </div>
</template>

<style scoped>
.ty {
  border: 1px solid var(--color-surface-border-subtle);
  border-radius: var(--radius-md);
  padding: var(--spacing-sm);
  margin-bottom: var(--spacing-sm);
  background-color: var(--color-surface-default);
}
.ty__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.ty__key {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--color-on-surface);
}
.ty__remove {
  background: none;
  border: none;
  color: var(--color-on-surface-subtle);
  font-size: 16px;
  cursor: pointer;
}
.ty__remove:hover {
  color: var(--color-status-error);
}
.ty__sample {
  color: var(--color-on-surface);
  margin: var(--spacing-sm) 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.ty__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-xs) var(--spacing-sm);
}
.ty__field {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.ty__field span {
  font-family: var(--font-sans);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-on-surface-subtle);
}
.ty__field input,
.ty__field select {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--color-on-surface);
  background-color: var(--color-surface-sunken);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  padding: 3px 6px;
}
</style>
