<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <main class="landing">
    <div class="landing__content">
      <p class="landing__overline">AI-Ready Design System Generator</p>
      <h1 class="landing__title">Design Spec</h1>
      <p class="landing__description">
        Configure your design tokens. Export AI context files.<br />
        Let your agents build consistent, beautiful UIs.
      </p>
      <button class="landing__cta" @click="router.push('/workspace')">
        Open Workspace
      </button>
    </div>
  </main>
</template>

<style scoped>
.landing {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100dvh;
  background-color: var(--color-surface-page);
  padding: var(--spacing-xl);
}

.landing__content {
  max-width: 560px;
  text-align: center;
}

.landing__overline {
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-on-surface-muted);
  margin: 0 0 var(--spacing-md);
}

.landing__title {
  font-family: var(--font-display);
  font-size: 56px;
  font-weight: 400;
  line-height: 1.05;
  letter-spacing: -0.02em;
  color: var(--color-on-surface);
  margin: 0 0 var(--spacing-lg);
}

.landing__description {
  font-family: var(--font-sans);
  font-size: 16px;
  font-weight: 400;
  line-height: 1.65;
  color: var(--color-on-surface-muted);
  margin: 0 0 var(--spacing-2xl);
}

.landing__cta {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
  background-color: var(--color-primary);
  color: var(--color-on-primary);
  border: none;
  border-radius: var(--radius-md);
  padding: 10px var(--spacing-lg);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color var(--transition-duration-normal) var(--transition-easing-ease-out);
}

.landing__cta:hover {
  background-color: var(--color-primary-glow);
}

.landing__cta:active {
  background-color: var(--color-primary-dim);
}
</style>
