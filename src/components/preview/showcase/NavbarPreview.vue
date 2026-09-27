<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { Menu, X } from '@lucide/vue'
import { usePreviewKit, type PreviewProps } from './usePreviewKit'

const props = defineProps<PreviewProps>()
const { groupStyle, layoutReached, propDefault } = usePreviewKit()

const LINKS = ['Home', 'Docs', 'Pricing']
const menuId = useId()
const open = ref(false)

// Below the blueprint's layout breakpoint the links collapse behind a toggle.
const collapsed = computed(() => !layoutReached(props.name))
const brand = computed(() => propDefault(props.name, 'brand', 'Logo'))
const linkStyle = (i: number) => ({ ...groupStyle(props.name, 'link'), ...(i === 0 ? groupStyle(props.name, 'linkActive') : {}) })
</script>

<template>
  <div class="nb" :class="{ 'nb--collapsed': collapsed }" :data-testid="testid" :style="rootStyle">
    <div class="nb__bar">
      <strong class="nb__brand">{{ brand }}</strong>
      <nav v-if="!collapsed" class="nb__links" aria-label="Main">
        <a v-for="(l, i) in LINKS" :key="l" href="#" :aria-current="i === 0 ? 'page' : undefined" :style="linkStyle(i)" @click.prevent>{{ l }}</a>
      </nav>
      <button class="showcase__btn" :style="{ background: 'var(--color-primary)', color: 'var(--color-on-primary)', borderRadius: 'var(--rounded-md)' }">Sign in</button>
      <button
        v-if="collapsed"
        type="button"
        class="nb__toggle"
        :aria-expanded="open"
        :aria-controls="menuId"
        :aria-label="open ? 'Close menu' : 'Open menu'"
        data-testid="navbar-menu-toggle"
        @click="open = !open"
      >
        <component :is="open ? X : Menu" :size="18" aria-hidden="true" />
      </button>
    </div>
    <nav v-if="collapsed" v-show="open" :id="menuId" class="nb__menu" aria-label="Main">
      <a v-for="(l, i) in LINKS" :key="l" href="#" :aria-current="i === 0 ? 'page' : undefined" :style="linkStyle(i)" @click.prevent>{{ l }}</a>
    </nav>
  </div>
</template>

<style scoped>
.nb {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  width: 26rem;
  max-width: 100%;
  box-sizing: border-box;
}
.nb__bar {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}
.nb__brand {
  flex-shrink: 0;
}
.nb__links {
  display: flex;
  gap: var(--spacing-md);
  flex: 1;
  font-size: 13px;
}
.nb--collapsed .nb__brand {
  flex: 1;
}
.nb a {
  text-decoration: none;
  color: inherit;
}
.nb__toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  min-height: 36px;
  background: none;
  border: 0;
  color: inherit;
  cursor: pointer;
  border-radius: var(--rounded-md);
}
.nb__menu {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  font-size: 13px;
}
.nb a:focus-visible,
.nb__toggle:focus-visible {
  outline: 2px solid var(--color-interactive-focus-ring);
  outline-offset: 2px;
}
</style>
