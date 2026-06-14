<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'
import type { Framework } from '@/types/compiler'

const store = useDesignSystemStore()
const { schema } = storeToRefs(store)

const options: { id: Framework; label: string; pro?: boolean }[] = [
  { id: 'react-tailwind', label: 'React + Tailwind' },
  { id: 'vue-css', label: 'Vue + CSS' },
  { id: 'flutter', label: 'Flutter', pro: true },
]

const selected = computed(() => schema.value.export.frameworks)

function toggle(id: Framework, pro?: boolean) {
  if (pro) return
  const current = new Set(selected.value)
  if (current.has(id)) {
    if (current.size === 1) return // keep at least one framework
    current.delete(id)
  } else {
    current.add(id)
  }
  store.updateFrameworks(options.filter((o) => current.has(o.id)).map((o) => o.id))
}
</script>

<template>
  <div class="fw" role="group" aria-label="Output frameworks">
    <button
      v-for="opt in options"
      :key="opt.id"
      class="fw__chip"
      :class="{ 'fw__chip--on': selected.includes(opt.id), 'fw__chip--pro': opt.pro }"
      :aria-pressed="selected.includes(opt.id)"
      :disabled="opt.pro"
      :title="opt.pro ? `${opt.label} — Pro` : opt.label"
      @click="toggle(opt.id, opt.pro)"
    >
      {{ opt.label }}<span v-if="opt.pro" class="fw__pro-tag">Pro</span>
    </button>
  </div>
</template>

<style scoped>
.fw {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}
.fw__chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  padding: 4px 8px;
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 500;
  color: var(--color-on-surface-muted);
  cursor: pointer;
}
.fw__chip:hover:not(:disabled) {
  color: var(--color-on-surface);
}
.fw__chip--on {
  color: var(--color-on-primary);
  background-color: var(--color-primary);
  border-color: var(--color-primary);
}
.fw__chip--pro {
  opacity: 0.55;
  cursor: not-allowed;
}
.fw__pro-tag {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.8;
}
</style>
