<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    tokenKey: string
    value: string | number
    units?: string[]
    removable?: boolean
  }>(),
  { units: () => ['px', 'rem', 'em'], removable: true },
)
const emit = defineEmits<{
  update: [key: string, value: string]
  remove: [key: string]
}>()

function parse(v: string | number): { num: string; unit: string } {
  const s = String(v)
  const m = s.match(/^(-?[\d.]+)\s*([a-z%]*)$/i)
  if (!m) return { num: s, unit: props.units[0] }
  return { num: m[1], unit: m[2] || props.units[0] }
}

const num = ref(parse(props.value).num)
const unit = ref(parse(props.value).unit)
watch(
  () => props.value,
  (v) => {
    const p = parse(v)
    num.value = p.num
    unit.value = p.unit
  },
)

const composed = computed(() => `${num.value}${unit.value}`)

function commit() {
  if (num.value.trim() === '' || Number.isNaN(Number(num.value))) {
    const p = parse(props.value)
    num.value = p.num
    return
  }
  if (composed.value !== String(props.value)) emit('update', props.tokenKey, composed.value)
}
</script>

<template>
  <div class="row">
    <span class="row__key" :title="tokenKey">{{ tokenKey }}</span>
    <input
      v-model="num"
      class="row__num"
      inputmode="decimal"
      :aria-label="`${tokenKey} value`"
      @blur="commit"
      @keydown.enter="commit"
    />
    <select v-model="unit" class="row__unit" :aria-label="`${tokenKey} unit`" @change="commit">
      <option v-for="u in units" :key="u" :value="u">{{ u }}</option>
    </select>
    <button
      v-if="removable"
      class="row__remove"
      :aria-label="`Remove ${tokenKey}`"
      @click="emit('remove', tokenKey)"
    >
      ×
    </button>
  </div>
</template>

<style scoped>
.row {
  display: grid;
  grid-template-columns: 1fr 72px 64px auto;
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
.row__num,
.row__unit {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--color-on-surface);
  background-color: var(--color-surface-sunken);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  padding: 3px 6px;
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
