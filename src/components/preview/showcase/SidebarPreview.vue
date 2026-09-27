<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import type { CSSProperties, Component } from 'vue'
import { ChevronDown, ChevronRight, LayoutDashboard, FolderKanban, Settings, User, CreditCard, PanelLeftClose, PanelLeftOpen } from '@lucide/vue'
import { usePreviewKit, type PreviewProps } from './usePreviewKit'

const props = defineProps<PreviewProps>()
const { group, hasGroup, groupVal, groupStyle, layoutReached, propDefault } = usePreviewKit()

const ICONS: Record<string, Component> = {
  Dashboard: LayoutDashboard,
  Projects: FolderKanban,
  Settings: Settings,
  Profile: User,
  Billing: CreditCard,
}
const iconFor = (label: string) => ICONS[label] ?? LayoutDashboard

// Collapsed = the user toggled it, or the blueprint says so, or the viewport is
// below the layout breakpoint (mobile-first: an icon rail).
const toggled = ref<boolean | null>(null)
const collapsed = computed(() => toggled.value ?? (propDefault(props.name, 'collapsed', false) || !layoutReached(props.name)))
const collapsible = computed(() => propDefault(props.name, 'collapsible', true))
const groupOpen = ref(true)
const subId = useId()

const rootStyle = computed<CSSProperties>(() =>
  collapsed.value ? { ...props.rootStyle, ...groupStyle(props.name, 'collapsed') } : props.rootStyle,
)
// Icons show when the itemIcon suggestion is on — and always on the rail, where
// they are the only affordance.
const showIcons = computed(() => collapsed.value || hasGroup(props.name, 'itemIcon'))
function iconStyle(): CSSProperties {
  return { color: groupVal(props.name, 'itemIcon', 'textColor', 'currentColor') }
}
function iconSize(): number {
  return parseInt(String(group(props.name, 'itemIcon')?.size ?? '')) || 16
}
const activeStyle = computed(() => groupStyle(props.name, 'activeItem'))
</script>

<template>
  <!-- Sidebar: one-level vs multilevel; collapses to an icon rail -->
  <nav class="showcase__sidebar" :class="{ 'showcase__sidebar--collapsed': collapsed }" :data-testid="testid" :style="rootStyle" aria-label="Sidebar">
    <button
      v-if="collapsible"
      type="button"
      class="showcase__side-toggle"
      :aria-expanded="!collapsed"
      :aria-label="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
      data-testid="sidebar-collapse-toggle"
      @click="toggled = !collapsed"
    >
      <component :is="collapsed ? PanelLeftOpen : PanelLeftClose" :size="16" aria-hidden="true" />
    </button>
    <a href="#" class="showcase__side-item" aria-current="page" :style="activeStyle" :title="collapsed ? 'Dashboard' : undefined" @click.prevent>
      <component :is="iconFor('Dashboard')" v-if="showIcons" :size="iconSize()" :style="iconStyle()" aria-hidden="true" />
      <span :class="{ 'sr-only': collapsed }">Dashboard</span>
    </a>
    <a href="#" class="showcase__side-item" :title="collapsed ? 'Projects' : undefined" @click.prevent>
      <component :is="iconFor('Projects')" v-if="showIcons" :size="iconSize()" :style="iconStyle()" aria-hidden="true" />
      <span :class="{ 'sr-only': collapsed }">Projects</span>
    </a>
    <template v-if="variant === 'multilevel'">
      <button
        type="button"
        class="showcase__side-group"
        :aria-expanded="groupOpen && !collapsed"
        :aria-controls="subId"
        :title="collapsed ? 'Settings' : undefined"
        @click="groupOpen = !groupOpen"
      >
        <span class="showcase__side-label">
          <component :is="iconFor('Settings')" v-if="showIcons" :size="iconSize()" :style="iconStyle()" aria-hidden="true" />
          <span :class="{ 'sr-only': collapsed }">Settings</span>
        </span>
        <component :is="groupOpen ? ChevronDown : ChevronRight" v-if="!collapsed" :size="12" aria-hidden="true" />
      </button>
      <div v-show="groupOpen && !collapsed" :id="subId">
        <a href="#" class="showcase__side-sub" @click.prevent>Profile</a>
        <a href="#" class="showcase__side-sub" @click.prevent>Billing</a>
      </div>
    </template>
    <a v-else href="#" class="showcase__side-item" :title="collapsed ? 'Settings' : undefined" @click.prevent>
      <component :is="iconFor('Settings')" v-if="showIcons" :size="iconSize()" :style="iconStyle()" aria-hidden="true" />
      <span :class="{ 'sr-only': collapsed }">Settings</span>
    </a>
  </nav>
</template>

<style scoped>
.showcase__sidebar {
  display: flex;
  flex-direction: column;
  gap: 2px;
  box-sizing: border-box;
  max-width: 100%;
}
.showcase__side-toggle {
  align-self: flex-end;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  min-height: 32px;
  background: none;
  border: 0;
  color: inherit;
  opacity: 0.7;
  cursor: pointer;
}
.showcase__sidebar--collapsed .showcase__side-toggle {
  align-self: center;
}
.showcase__side-item,
.showcase__side-group,
.showcase__side-sub {
  font-size: 13px;
  padding: 6px 8px;
  border-radius: var(--rounded-sm);
  color: inherit;
  text-decoration: none;
}
.showcase__side-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}
.showcase__sidebar--collapsed .showcase__side-item,
.showcase__sidebar--collapsed .showcase__side-group {
  justify-content: center;
}
.showcase__side-group {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  background: none;
  border: 0;
  cursor: pointer;
  text-align: left;
}
.showcase__side-label {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}
.showcase__side-sub {
  display: block;
  padding-left: var(--spacing-lg);
  opacity: 0.8;
}
.showcase__sidebar a:focus-visible,
.showcase__sidebar button:focus-visible {
  outline: 2px solid var(--color-interactive-focus-ring);
  outline-offset: 1px;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>
