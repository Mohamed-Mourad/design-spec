<script setup lang="ts">
import type { CSSProperties, Component } from 'vue'
import { ChevronDown, LayoutDashboard, FolderKanban, Settings, User, CreditCard } from '@lucide/vue'
import { usePreviewKit, type PreviewProps } from './usePreviewKit'

const props = defineProps<PreviewProps>()
const { group, hasGroup, groupVal } = usePreviewKit()

// Menu-item icons (suggestion: tokens.itemIcon).
const ICONS: Record<string, Component> = {
  Dashboard: LayoutDashboard,
  Projects: FolderKanban,
  Settings: Settings,
  Profile: User,
  Billing: CreditCard,
}
const iconFor = (label: string) => ICONS[label] ?? LayoutDashboard
function iconStyle(): CSSProperties {
  return { color: groupVal(props.name, 'itemIcon', 'textColor', 'currentColor') }
}
function iconSize(): number {
  return parseInt(String(group(props.name, 'itemIcon')?.size ?? '')) || 16
}
</script>

<template>
  <!-- Sidebar: one-level vs multilevel -->
  <div class="showcase__sidebar" :data-testid="testid" :style="rootStyle">
    <div class="showcase__side-item">
      <component :is="iconFor('Dashboard')" v-if="hasGroup(name, 'itemIcon')" :size="iconSize()" :style="iconStyle()" aria-hidden="true" />Dashboard
    </div>
    <div class="showcase__side-item">
      <component :is="iconFor('Projects')" v-if="hasGroup(name, 'itemIcon')" :size="iconSize()" :style="iconStyle()" aria-hidden="true" />Projects
    </div>
    <template v-if="variant === 'multilevel'">
      <div class="showcase__side-group">
        <span class="showcase__side-label"><component :is="iconFor('Settings')" v-if="hasGroup(name, 'itemIcon')" :size="iconSize()" :style="iconStyle()" aria-hidden="true" />Settings</span>
        <ChevronDown :size="12" aria-hidden="true" />
      </div>
      <div class="showcase__side-sub">Profile</div>
      <div class="showcase__side-sub">Billing</div>
    </template>
    <div v-else class="showcase__side-item">
      <component :is="iconFor('Settings')" v-if="hasGroup(name, 'itemIcon')" :size="iconSize()" :style="iconStyle()" aria-hidden="true" />Settings
    </div>
  </div>
</template>

<style scoped>
.showcase__sidebar {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.showcase__side-item,
.showcase__side-group,
.showcase__side-sub {
  font-size: 13px;
  padding: 6px 8px;
  border-radius: var(--radius-sm);
}
.showcase__side-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}
.showcase__side-group {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
}
.showcase__side-label {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}
.showcase__side-sub {
  padding-left: var(--spacing-lg);
  opacity: 0.8;
}
</style>
