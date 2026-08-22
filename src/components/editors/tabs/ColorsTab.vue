<script setup lang="ts">
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'
import ColorTokenEditor from '@/components/editors/ColorTokenEditor.vue'
import AddTokenRow from '@/components/editors/AddTokenRow.vue'
import TokenStateRow from '@/components/shared/TokenStateRow.vue'

const store = useDesignSystemStore()
const { schema } = storeToRefs(store)

const mode = ref<'light' | 'dark'>('light')

// ── Light (base) ──
function update(key: string, value: string) {
  store.setPath(['colors', key], value)
}
function remove(key: string) {
  store.removePath(['colors', key])
}
function add(name: string) {
  if (name in schema.value.colors) return
  store.setPath(['colors', name], '#888888')
}

// ── Dark overrides (keys not overridden inherit the light value) ──
const darkColors = computed(() => schema.value.darkMode.colors)
const isOverridden = (key: string) => key in darkColors.value
const darkValue = (key: string) => darkColors.value[key] ?? schema.value.colors[key]
function updateDark(key: string, value: string) {
  store.setPath(['darkMode', 'colors', key], value)
}
function clearDark(key: string) {
  store.removePath(['darkMode', 'colors', key])
}
</script>

<template>
  <section>
    <div class="modes" role="group" aria-label="Color mode">
      <button class="modes__btn" :class="{ 'modes__btn--on': mode === 'light' }" @click="mode = 'light'">
        Light
      </button>
      <button class="modes__btn" :class="{ 'modes__btn--on': mode === 'dark' }" @click="mode = 'dark'">
        Dark
      </button>
    </div>

    <template v-if="mode === 'light'">
      <TokenStateRow v-for="(value, key) in schema.colors" :key="key" group="colors" :token-key="key">
        <ColorTokenEditor :token-key="key" :value="value" @update="update" @remove="remove" />
      </TokenStateRow>
      <AddTokenRow placeholder="new color token" @add="add" />
    </template>

    <template v-else>
      <p class="hint">Toggle the preview moon to see these. Clear (×) a row to inherit the light value.</p>
      <div v-for="(_, key) in schema.colors" :key="key" class="dark-row">
        <span class="dark-row__badge" :class="{ 'dark-row__badge--on': isOverridden(key) }">
          {{ isOverridden(key) ? '●' : '○' }}
        </span>
        <TokenStateRow group="darkMode.colors" :token-key="key">
          <ColorTokenEditor :token-key="key" :value="darkValue(key)" @update="updateDark" @remove="clearDark" />
        </TokenStateRow>
      </div>
    </template>
  </section>
</template>

<style scoped>
.modes {
  display: flex;
  gap: 2px;
  margin-bottom: var(--spacing-md);
}
.modes__btn {
  flex: 1;
  background-color: var(--color-surface-sunken);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  padding: 4px 8px;
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 500;
  color: var(--color-on-surface-muted);
  cursor: pointer;
}
.modes__btn--on {
  color: var(--color-on-primary);
  background-color: var(--color-primary);
  border-color: var(--color-primary);
}
.hint {
  font-family: var(--font-sans);
  font-size: 11px;
  color: var(--color-on-surface-subtle);
  margin: 0 0 var(--spacing-sm);
}
.dark-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}
.dark-row > :deep(.tsr) {
  flex: 1;
  min-width: 0;
}
.dark-row__badge {
  font-size: 9px;
  color: var(--color-on-surface-subtle);
  width: 10px;
}
.dark-row__badge--on {
  color: var(--color-primary);
}
</style>
