<script setup lang="ts">
import { computed } from 'vue'
import type { DesignSystemSchema } from '@/types/schema'

const props = defineProps<{ schema: DesignSystemSchema }>()

const keywords = computed(() => props.schema.overview.moodKeywords.slice(0, 6))
</script>

<template>
  <div class="identity">
    <p class="identity__name">{{ schema.name }}</p>
    <p v-if="schema.description" class="identity__description">{{ schema.description }}</p>
    <dl class="identity__facts">
      <div v-if="schema.overview.brandPersonality" class="identity__fact">
        <dt>Personality</dt>
        <dd>{{ schema.overview.brandPersonality }}</dd>
      </div>
      <div v-if="schema.overview.aestheticDirection" class="identity__fact">
        <dt>Direction</dt>
        <dd>{{ schema.overview.aestheticDirection }}</dd>
      </div>
      <div v-if="schema.overview.targetAudience" class="identity__fact">
        <dt>Audience</dt>
        <dd>{{ schema.overview.targetAudience }}</dd>
      </div>
    </dl>
    <ul v-if="keywords.length" class="identity__keywords">
      <li v-for="word in keywords" :key="word" class="identity__keyword">{{ word }}</li>
    </ul>
  </div>
</template>

<style scoped>
.identity {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.identity__name {
  margin: 0;
  font-family: var(--font-display);
  font-size: 34px;
  font-weight: 400;
  letter-spacing: -0.015em;
  line-height: 1.1;
  color: var(--bento-fg);
}

.identity__description {
  margin: 0;
  max-width: 52ch;
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.6;
  color: var(--bento-fg-muted);
}

.identity__facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 10px 20px;
  margin: 0;
}

.identity__fact dt {
  font-family: var(--font-sans);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--bento-fg-subtle);
}

.identity__fact dd {
  margin: 2px 0 0;
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--bento-fg-muted);
}

.identity__keywords {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.identity__keyword {
  padding: 3px 9px;
  border: 1px solid var(--bento-border);
  border-radius: 999px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--bento-fg-muted);
}
</style>
