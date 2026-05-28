<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { useRouter } from 'vue-router'

const router = useRouter()

useHead({
  title: 'Design Spec — AI-Ready Design System Generator',
  meta: [
    { name: 'description', content: 'Configure your design tokens. Export DESIGN.md and SKILL.md. Let your AI agents build consistent, beautiful UIs.' },
    { property: 'og:title', content: 'Design Spec — AI-Ready Design System Generator' },
    { property: 'og:description', content: 'Configure your design tokens. Export DESIGN.md and SKILL.md. Let your AI agents build consistent, beautiful UIs.' },
  ],
})

const features = [
  {
    icon: '◈',
    title: 'Full token taxonomy',
    description: 'Colors, typography, spacing, shadows, motion, breakpoints, z-index — every token an AI agent needs to make correct decisions without guessing.',
  },
  {
    icon: '⟐',
    title: 'Multi-framework output',
    description: 'Compile to React + Tailwind, Vue + CSS variables, or Flutter in one click. Component stubs with correct responsive classes included.',
  },
  {
    icon: '✦',
    title: 'AI context files',
    description: 'DESIGN.md and SKILL.md are structured exactly for AI agents. Drop them in .claude/, .cursor/, or .windsurf/ and your agent knows your design system.',
  },
  {
    icon: '⬡',
    title: 'Zero backend',
    description: 'Runs entirely in your browser. No account required. Export a ZIP and own your files. $0 forever.',
  },
]

const freeTier = [
  'Workspace — all token editors',
  'DESIGN.md + SKILL.md generation',
  'React/Tailwind + Vue compilers',
  'Download ZIP',
  'Figma import (colors + typography)',
  'CLI init + diff',
]

const proTier = [
  'Everything in Free',
  'Flutter compiler',
  'One-click GitHub push',
  'Figma Variables API (full token set + dark mode)',
  'LLM functional components (bring your own key)',
  'CLI sync + push + watch mode',
  'Feature vote weight 5×',
]
</script>

<template>
  <div class="landing">
    <!-- Nav -->
    <nav class="landing__nav">
      <span class="landing__logo">Design Spec</span>
      <div class="landing__nav-links">
        <a href="/features" @click.prevent="router.push('/features')" class="landing__nav-link">Feature requests</a>
        <button class="landing__nav-cta" @click="router.push('/workspace')">Open workspace</button>
      </div>
    </nav>

    <!-- Hero -->
    <section class="landing__hero">
      <p class="landing__overline">AI-Ready Design System Generator</p>
      <h1 class="landing__title">Your design tokens,<br />in a language AI understands.</h1>
      <p class="landing__subtitle">
        Configure colors, typography, spacing, and components.<br />
        Export structured context files your AI agents can actually use.
      </p>
      <div class="landing__hero-actions">
        <button class="landing__cta-primary" @click="router.push('/workspace')">
          Open workspace — free
        </button>
        <a
          href="https://github.com/moh-mourad/design-spec"
          target="_blank"
          rel="noopener"
          class="landing__cta-ghost"
        >
          View on GitHub
        </a>
      </div>
    </section>

    <!-- Features -->
    <section class="landing__features">
      <h2 class="landing__section-title">Everything an AI agent needs</h2>
      <div class="landing__features-grid">
        <div v-for="f in features" :key="f.title" class="landing__feature-card">
          <span class="landing__feature-icon">{{ f.icon }}</span>
          <h3 class="landing__feature-title">{{ f.title }}</h3>
          <p class="landing__feature-desc">{{ f.description }}</p>
        </div>
      </div>
    </section>

    <!-- Pricing -->
    <section class="landing__pricing">
      <h2 class="landing__section-title">Simple pricing</h2>
      <p class="landing__section-sub">Free to use forever. Pro for power users.</p>
      <div class="landing__pricing-grid">
        <!-- Free -->
        <div class="landing__plan">
          <div class="landing__plan-header">
            <h3 class="landing__plan-name">Free</h3>
            <div class="landing__plan-price">
              <span class="landing__plan-amount">$0</span>
              <span class="landing__plan-period">forever</span>
            </div>
          </div>
          <ul class="landing__plan-features">
            <li v-for="item in freeTier" :key="item" class="landing__plan-item">
              <span class="landing__plan-check">✓</span>{{ item }}
            </li>
          </ul>
          <button class="landing__plan-btn landing__plan-btn--free" @click="router.push('/workspace')">
            Get started free
          </button>
        </div>

        <!-- Pro -->
        <div class="landing__plan landing__plan--pro">
          <div class="landing__plan-badge">Pro</div>
          <div class="landing__plan-header">
            <h3 class="landing__plan-name">Pro</h3>
            <div class="landing__plan-price">
              <span class="landing__plan-amount">TBD</span>
              <span class="landing__plan-period">/ month</span>
            </div>
          </div>
          <ul class="landing__plan-features">
            <li v-for="item in proTier" :key="item" class="landing__plan-item">
              <span class="landing__plan-check landing__plan-check--pro">✓</span>{{ item }}
            </li>
          </ul>
          <button class="landing__plan-btn landing__plan-btn--pro" disabled>
            Coming soon
          </button>
        </div>
      </div>

      <!-- $12 pass note -->
      <p class="landing__pass-note">
        Want to support the project? A one-time <strong>$12 Voting Pass</strong> gives your feature requests 5× weight. Coming soon.
      </p>
    </section>

    <!-- Footer -->
    <footer class="landing__footer">
      <span>© 2026 Design Spec</span>
      <div class="landing__footer-links">
        <a href="/features" @click.prevent="router.push('/features')" class="landing__footer-link">Feature requests</a>
        <a
          href="https://github.com/moh-mourad/design-spec"
          target="_blank"
          rel="noopener"
          class="landing__footer-link"
        >GitHub</a>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.landing {
  min-height: 100dvh;
  background-color: var(--color-surface-page);
  color: var(--color-on-surface);
  font-family: var(--font-sans);
}

/* Nav */
.landing__nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md) var(--spacing-2xl);
  border-bottom: 1px solid var(--color-surface-border-subtle);
  position: sticky;
  top: 0;
  background-color: var(--color-surface-page);
  z-index: var(--z-sticky);
}

.landing__logo {
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 400;
  letter-spacing: -0.01em;
  color: var(--color-on-surface);
}

.landing__nav-links {
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);
}

.landing__nav-link {
  font-size: 13px;
  color: var(--color-on-surface-muted);
  text-decoration: none;
  transition: color var(--transition-duration-fast) var(--transition-easing-ease-out);
}
.landing__nav-link:hover { color: var(--color-on-surface); }

.landing__nav-cta {
  display: inline-flex;
  align-items: center;
  background-color: var(--color-primary);
  color: var(--color-on-primary);
  border: none;
  border-radius: var(--radius-md);
  padding: 6px var(--spacing-md);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color var(--transition-duration-fast) var(--transition-easing-ease-out);
}
.landing__nav-cta:hover { background-color: var(--color-primary-glow); }

/* Hero */
.landing__hero {
  max-width: 760px;
  margin: 0 auto;
  padding: var(--spacing-4xl) var(--spacing-xl);
  text-align: center;
}

.landing__overline {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-primary);
  margin: 0 0 var(--spacing-md);
}

.landing__title {
  font-family: var(--font-display);
  font-size: clamp(36px, 5vw, 60px);
  font-weight: 400;
  line-height: 1.08;
  letter-spacing: -0.02em;
  color: var(--color-on-surface);
  margin: 0 0 var(--spacing-lg);
}

.landing__subtitle {
  font-size: 17px;
  font-weight: 400;
  line-height: 1.65;
  color: var(--color-on-surface-muted);
  margin: 0 0 var(--spacing-2xl);
}

.landing__hero-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-md);
  flex-wrap: wrap;
}

.landing__cta-primary {
  display: inline-flex;
  align-items: center;
  background-color: var(--color-primary);
  color: var(--color-on-primary);
  border: none;
  border-radius: var(--radius-md);
  padding: 10px var(--spacing-lg);
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color var(--transition-duration-normal) var(--transition-easing-ease-out);
}
.landing__cta-primary:hover { background-color: var(--color-primary-glow); }
.landing__cta-primary:active { background-color: var(--color-primary-dim); }

.landing__cta-ghost {
  display: inline-flex;
  align-items: center;
  color: var(--color-on-surface-muted);
  text-decoration: none;
  font-size: 14px;
  font-weight: 400;
  padding: 10px var(--spacing-md);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-surface-border);
  transition: color var(--transition-duration-fast) var(--transition-easing-ease-out),
              border-color var(--transition-duration-fast) var(--transition-easing-ease-out);
}
.landing__cta-ghost:hover {
  color: var(--color-on-surface);
  border-color: var(--color-on-surface-subtle);
}

/* Features */
.landing__features {
  max-width: 960px;
  margin: 0 auto;
  padding: var(--spacing-4xl) var(--spacing-xl);
}

.landing__section-title {
  font-family: var(--font-display);
  font-size: clamp(24px, 3vw, 36px);
  font-weight: 400;
  letter-spacing: -0.015em;
  color: var(--color-on-surface);
  text-align: center;
  margin: 0 0 var(--spacing-2xl);
}

.landing__section-sub {
  font-size: 15px;
  color: var(--color-on-surface-muted);
  text-align: center;
  margin: calc(-1 * var(--spacing-xl)) 0 var(--spacing-2xl);
}

.landing__features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--spacing-lg);
}

.landing__feature-card {
  background-color: var(--color-surface-raised);
  border: 1px solid var(--color-surface-border-subtle);
  border-radius: var(--radius-lg);
  padding: var(--spacing-xl);
}

.landing__feature-icon {
  display: block;
  font-size: 22px;
  color: var(--color-primary);
  margin-bottom: var(--spacing-md);
}

.landing__feature-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-on-surface);
  margin: 0 0 var(--spacing-sm);
}

.landing__feature-desc {
  font-size: 13px;
  line-height: 1.6;
  color: var(--color-on-surface-muted);
  margin: 0;
}

/* Pricing */
.landing__pricing {
  max-width: 760px;
  margin: 0 auto;
  padding: var(--spacing-4xl) var(--spacing-xl);
}

.landing__pricing-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-lg);
}

.landing__plan {
  position: relative;
  background-color: var(--color-surface-raised);
  border: 1px solid var(--color-surface-border-subtle);
  border-radius: var(--radius-xl);
  padding: var(--spacing-xl);
  display: flex;
  flex-direction: column;
}

.landing__plan--pro {
  border-color: var(--color-primary);
}

.landing__plan-badge {
  position: absolute;
  top: -10px;
  left: var(--spacing-xl);
  background-color: var(--color-primary);
  color: var(--color-on-primary);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 2px 8px;
  border-radius: var(--radius-full);
}

.landing__plan-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: var(--spacing-lg);
  padding-bottom: var(--spacing-lg);
  border-bottom: 1px solid var(--color-surface-border-subtle);
}

.landing__plan-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-on-surface);
  margin: 0;
}

.landing__plan-price {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.landing__plan-amount {
  font-family: var(--font-display);
  font-size: 28px;
  font-weight: 400;
  color: var(--color-on-surface);
}

.landing__plan-period {
  font-size: 12px;
  color: var(--color-on-surface-muted);
}

.landing__plan-features {
  list-style: none;
  padding: 0;
  margin: 0 0 var(--spacing-xl);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  flex: 1;
}

.landing__plan-item {
  display: flex;
  align-items: baseline;
  gap: var(--spacing-sm);
  font-size: 13px;
  color: var(--color-on-surface-muted);
}

.landing__plan-check {
  color: var(--color-on-surface-subtle);
  font-size: 11px;
  flex-shrink: 0;
}

.landing__plan-check--pro {
  color: var(--color-primary);
}

.landing__plan-btn {
  width: 100%;
  padding: 10px;
  border-radius: var(--radius-md);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: background-color var(--transition-duration-fast) var(--transition-easing-ease-out);
}

.landing__plan-btn--free {
  background-color: var(--color-surface-overlay);
  color: var(--color-on-surface);
}
.landing__plan-btn--free:hover { background-color: var(--color-surface-border); }

.landing__plan-btn--pro {
  background-color: var(--color-primary);
  color: var(--color-on-primary);
}
.landing__plan-btn--pro:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.landing__pass-note {
  font-size: 13px;
  color: var(--color-on-surface-muted);
  text-align: center;
  margin: 0;
  padding: var(--spacing-md);
  border: 1px solid var(--color-surface-border-subtle);
  border-radius: var(--radius-md);
  background-color: var(--color-surface-sunken);
}
.landing__pass-note strong {
  color: var(--color-on-surface);
}

/* Footer */
.landing__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-lg) var(--spacing-2xl);
  border-top: 1px solid var(--color-surface-border-subtle);
  font-size: 12px;
  color: var(--color-on-surface-subtle);
}

.landing__footer-links {
  display: flex;
  gap: var(--spacing-lg);
}

.landing__footer-link {
  color: var(--color-on-surface-muted);
  text-decoration: none;
  transition: color var(--transition-duration-fast) var(--transition-easing-ease-out);
}
.landing__footer-link:hover { color: var(--color-on-surface); }
</style>
