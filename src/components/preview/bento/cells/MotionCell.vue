<script setup lang="ts">
import { computed } from 'vue'
import type { DesignSystemSchema } from '@/types/schema'

const props = defineProps<{ schema: DesignSystemSchema }>()

const durations = computed(() => Object.entries(props.schema.transitions.duration))
const easings = computed(() => Object.entries(props.schema.transitions.easing))
</script>

<template>
  <div class="motion">
    <ul class="motion__list">
      <li v-for="[key, value] in durations" :key="key" class="motion__row">
        <span class="motion__name">{{ key }}</span>
        <span class="motion__track">
          <span
            class="motion__fill"
            :style="{ animationDuration: value, animationTimingFunction: easings[0]?.[1] ?? 'linear' }"
          />
        </span>
        <span class="motion__value">{{ value }}</span>
      </li>
    </ul>
    <ul class="motion__list">
      <li v-for="[key, value] in easings" :key="key" class="motion__easing">
        <span class="motion__name">{{ key }}</span>
        <span class="motion__curve">{{ value }}</span>
      </li>
    </ul>
    <p v-if="schema.transitions.reducedMotion" class="motion__note">Honors prefers-reduced-motion</p>
  </div>
</template>

<style scoped>
.motion {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.motion__list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.motion__row {
  display: grid;
  grid-template-columns: 56px 1fr auto;
  align-items: center;
  gap: 10px;
}

.motion__name {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--bento-fg-muted);
  overflow: hidden;
  text-overflow: ellipsis;
}

.motion__track {
  display: block;
  overflow: hidden;
  height: 6px;
  border-radius: 3px;
  background-color: var(--bento-border);
}

.motion__fill {
  display: block;
  height: 100%;
  border-radius: 3px;
  background-color: var(--bento-accent);
  transform: scaleX(1);
  transform-origin: left center;
}

/* A still frame is the honest default; the loop only runs where motion is welcome. */
@media (prefers-reduced-motion: no-preference) {
  .motion__fill {
    animation-name: motion-fill;
    animation-iteration-count: infinite;
    animation-direction: alternate;
  }
}

@keyframes motion-fill {
  from {
    transform: scaleX(0.04);
  }
  to {
    transform: scaleX(1);
  }
}

.motion__value,
.motion__curve {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--bento-fg-subtle);
}

.motion__easing {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
}

.motion__curve {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.motion__note {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 11px;
  color: var(--bento-fg-subtle);
}
</style>
