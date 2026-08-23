<script setup lang="ts">
defineProps<{
  label: string
  /** Half-width (1) or full-width (2) of the bento grid's column pair. */
  span?: 1 | 2
}>()
</script>

<template>
  <section class="bento-cell" :class="span === 2 ? 'bento-cell--wide' : ''">
    <h2 class="bento-cell__label">{{ label }}</h2>
    <div class="bento-cell__body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.bento-cell {
  grid-column: span 1;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
  padding: 20px;
  border: 1px solid var(--bento-border);
  border-radius: 14px;
  background-color: var(--bento-surface);
  overflow: hidden;
}

.bento-cell--wide {
  grid-column: span 2;
}

.bento-cell__label {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--bento-fg-subtle);
}

.bento-cell__body {
  flex: 1;
  min-width: 0;
}

@media (max-width: 720px) {
  .bento-cell,
  .bento-cell--wide {
    grid-column: span 1;
  }
}
</style>
