<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { Info, CircleCheck, TriangleAlert, CircleAlert, X, ChevronDown, LayoutDashboard, FolderKanban, Settings, User, CreditCard } from '@lucide/vue'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'
import type { ComponentBlueprint } from '@/types/schema'
import { resolveComponentStyle, refToVar } from '@/utils/previewStyle'
import type { CSSProperties, Component } from 'vue'

const store = useDesignSystemStore()
const { schema, viewportWidth, selectedComponent } = storeToRefs(store)

// Alert: icon + title/message driven by the blueprint's prop defaults.
const alertBp = computed(() => schema.value.componentBlueprints.Alert)
const alertCfg = computed(() => ({
  placement: (alertBp.value?.props.iconPlacement?.default as string) ?? 'leading',
  content: (alertBp.value?.props.content?.default as string) ?? 'title-message',
}))
const ALERT_ICONS: Record<string, Component> = { info: Info, success: CircleCheck, warning: TriangleAlert, error: CircleAlert }
const ALERT_TITLES: Record<string, string> = { info: 'Information', success: 'Success', warning: 'Warning', error: 'Error' }
const alertIcon = (v: string) => ALERT_ICONS[v] ?? Info
const alertTitle = (v: string) => ALERT_TITLES[v] ?? v

// Blueprint capability helpers — suggestions are token groups on the blueprint.
const bpOf = (n: string) => schema.value.componentBlueprints[n]
const hasGroup = (n: string, k: string) => !!bpOf(n)?.tokens[k]
const hasHover = (n: string) => hasGroup(n, 'hover')
const isDismissible = (n: string) => hasGroup(n, 'close')
function groupVal(n: string, k: string, prop: string, fallback: string): string {
  const g = bpOf(n)?.tokens[k] as Record<string, unknown> | undefined
  return g && g[prop] != null ? refToVar(g[prop]) : fallback
}
function sepStyle(n: string): CSSProperties {
  return { borderTop: `${groupVal(n, 'separator', 'borderWidth', '1px')} solid ${groupVal(n, 'separator', 'borderColor', 'currentColor')}` }
}
function closeStyle(n: string): CSSProperties {
  return { color: groupVal(n, 'close', 'textColor', 'currentColor') }
}
function closeSize(n: string): number {
  const g = bpOf(n)?.tokens.close as Record<string, unknown> | undefined
  return parseInt(String(g?.size ?? '')) || 16
}
function actionLabel(n: string, which: 'cancelLabel' | 'confirmLabel', fallback: string): string {
  const g = bpOf(n)?.tokens.actions as Record<string, unknown> | undefined
  return (g?.[which] as string) || fallback
}
function actionBtnStyle(n: string, role: 'cancel' | 'confirm'): CSSProperties {
  const confirm = role === 'confirm'
  return {
    background: groupVal(n, 'actions', confirm ? 'confirmBg' : 'cancelBg', confirm ? 'var(--color-primary)' : 'var(--color-surface-raised)'),
    color: groupVal(n, 'actions', confirm ? 'confirmText' : 'cancelText', confirm ? 'var(--color-on-primary)' : 'var(--color-on-surface)'),
    borderRadius: groupVal(n, 'actions', 'rounded', 'var(--rounded-md)'),
    borderColor: 'transparent',
  }
}

interface VariantRender {
  variant: string
  style: CSSProperties
  hoverStyle: CSSProperties | null
  hidden: boolean
}
interface Rendered {
  name: string
  variants: VariantRender[]
}

const rendered = computed<Rendered[]>(() =>
  Object.values(schema.value.componentBlueprints).map((bp: ComponentBlueprint) => {
    const variants = bp.variants.length ? bp.variants : ['default']
    return {
      name: bp.name,
      variants: variants.map((variant) => {
        const v = bp.variants.length ? variant : undefined
        const { style, hidden } = resolveComponentStyle(schema.value, bp, viewportWidth.value, v)
        const hoverStyle = bp.tokens.hover
          ? resolveComponentStyle(schema.value, bp, viewportWidth.value, v, ['hover']).style
          : null
        return { variant, style, hoverStyle, hidden }
      }),
    }
  }),
)

const hovered = ref<string | null>(null)
const key = (name: string, variant: string) => `${name}:${variant}`
function styleFor(name: string, vr: VariantRender): CSSProperties {
  return hasHover(name) && vr.hoverStyle && hovered.value === key(name, vr.variant) ? vr.hoverStyle : vr.style
}

function sampleText(name: string, variant: string): string {
  return variant === 'default' ? name : variant
}

// Resolve a named state group (e.g. 'checked') for inline use.
function stateStyle(n: string, group: string): CSSProperties {
  const bp = bpOf(n)
  return bp ? resolveComponentStyle(schema.value, bp, viewportWidth.value, undefined, [group]).style : {}
}

// Sidebar menu-item icons (suggestion: tokens.itemIcon).
const SIDEBAR_ICONS: Record<string, Component> = {
  Dashboard: LayoutDashboard,
  Projects: FolderKanban,
  Settings: Settings,
  Profile: User,
  Billing: CreditCard,
}
const sidebarIcon = (label: string) => SIDEBAR_ICONS[label] ?? LayoutDashboard
function itemIconStyle(): CSSProperties {
  return { color: groupVal('Sidebar', 'itemIcon', 'textColor', 'currentColor') }
}
function itemIconSize(): number {
  const g = bpOf('Sidebar')?.tokens.itemIcon as Record<string, unknown> | undefined
  return parseInt(String(g?.size ?? '')) || 16
}
</script>

<template>
  <div class="showcase">
    <section
      v-for="c in rendered"
      :key="c.name"
      class="showcase__group"
      :class="{ 'showcase__group--selected': selectedComponent === c.name }"
      role="button"
      :tabindex="0"
      @click="store.selectComponent(c.name)"
      @keydown.enter="store.selectComponent(c.name)"
    >
      <header class="showcase__name">{{ c.name }}<span class="showcase__edit">edit</span></header>
      <div class="showcase__variants">
        <div
          v-for="(vr, i) in c.variants"
          :key="vr.variant"
          class="showcase__cell"
          @mouseenter="hovered = key(c.name, vr.variant)"
          @mouseleave="hovered = null"
        >
          <span class="showcase__variant-label">{{ vr.variant }}</span>

          <template v-if="!vr.hidden">
            <button v-if="c.name === 'Button'" :data-testid="i === 0 ? `preview-${c.name}` : `preview-${c.name}-${vr.variant}`" :style="styleFor(c.name, vr)">
              {{ sampleText(c.name, vr.variant) }}
            </button>

            <input v-else-if="c.name === 'Input'" :data-testid="i === 0 ? `preview-${c.name}` : `preview-${c.name}-${vr.variant}`" :style="styleFor(c.name, vr)" placeholder="Placeholder" />

            <span v-else-if="c.name === 'Badge'" :data-testid="i === 0 ? `preview-${c.name}` : `preview-${c.name}-${vr.variant}`" :style="styleFor(c.name, vr)">{{ sampleText(c.name, vr.variant) }}</span>

            <!-- Card: title, optional separator, body, optional actions/close -->
            <div v-else-if="c.name === 'Card'" class="showcase__card" :data-testid="i === 0 ? `preview-${c.name}` : `preview-${c.name}-${vr.variant}`" :style="styleFor(c.name, vr)">
              <div class="showcase__card-head">
                <strong>Card title</strong>
                <button v-if="isDismissible('Card')" class="showcase__x" :style="closeStyle('Card')" aria-label="Close"><X :size="closeSize('Card')" /></button>
              </div>
              <hr v-if="hasGroup('Card', 'separator')" class="showcase__sep" :style="sepStyle('Card')" />
              <p class="showcase__card-body">Grouped content lives here.</p>
              <div v-if="hasGroup('Card', 'actions')" class="showcase__actions">
                <button class="showcase__btn" :style="actionBtnStyle('Card', 'cancel')">{{ actionLabel('Card', 'cancelLabel', 'Cancel') }}</button>
                <button class="showcase__btn" :style="actionBtnStyle('Card', 'confirm')">{{ actionLabel('Card', 'confirmLabel', 'Confirm') }}</button>
              </div>
            </div>

            <!-- Alert: icon + title/message, optional separator, actions, close -->
            <div v-else-if="c.name === 'Alert'" class="showcase__alert" :data-testid="i === 0 ? `preview-${c.name}` : `preview-${c.name}-${vr.variant}`" :style="styleFor(c.name, vr)">
              <component :is="alertIcon(vr.variant)" v-if="alertCfg.placement === 'leading'" :size="16" :style="{ color: vr.style.borderColor }" aria-hidden="true" />
              <div class="showcase__alert-body">
                <strong v-if="alertCfg.content === 'title-message'">{{ alertTitle(vr.variant) }}</strong>
                <hr v-if="hasGroup('Alert', 'separator')" class="showcase__sep" :style="sepStyle('Alert')" />
                <span>Something needs your attention.</span>
                <div v-if="hasGroup('Alert', 'actions')" class="showcase__actions">
                  <button class="showcase__btn" :style="actionBtnStyle('Alert', 'cancel')">{{ actionLabel('Alert', 'cancelLabel', 'Cancel') }}</button>
                  <button class="showcase__btn" :style="actionBtnStyle('Alert', 'confirm')">{{ actionLabel('Alert', 'confirmLabel', 'Confirm') }}</button>
                </div>
              </div>
              <component :is="alertIcon(vr.variant)" v-if="alertCfg.placement === 'trailing'" :size="16" :style="{ color: vr.style.borderColor }" aria-hidden="true" />
              <button v-if="isDismissible('Alert')" class="showcase__x" :style="closeStyle('Alert')" aria-label="Close"><X :size="closeSize('Alert')" /></button>
            </div>

            <label v-else-if="c.name === 'Checkbox'" class="showcase__checkbox-row" :data-testid="i === 0 ? `preview-${c.name}` : `preview-${c.name}-${vr.variant}`">
              <span class="showcase__checkbox" :style="styleFor(c.name, vr)" />
              Label
            </label>

            <span v-else-if="c.name === 'Tooltip'" :data-testid="i === 0 ? `preview-${c.name}` : `preview-${c.name}-${vr.variant}`" :style="styleFor(c.name, vr)">{{ sampleText(c.name, vr.variant) }}</span>

            <!-- Dropdown -->
            <div v-else-if="c.name === 'Dropdown'" class="showcase__dropdown" :data-testid="i === 0 ? `preview-${c.name}` : `preview-${c.name}-${vr.variant}`" :style="styleFor(c.name, vr)">
              <span>Select option</span>
              <ChevronDown :size="14" aria-hidden="true" />
            </div>

            <!-- Radio group (selected + unselected) -->
            <div v-else-if="c.name === 'Radio'" class="showcase__radio-group" :data-testid="i === 0 ? `preview-${c.name}` : `preview-${c.name}-${vr.variant}`">
              <label class="showcase__radio-row">
                <span class="showcase__radio" :style="stateStyle('Radio', 'checked')"><span class="showcase__radio-dot" /></span>Option A
              </label>
              <label class="showcase__radio-row">
                <span class="showcase__radio" :style="styleFor(c.name, vr)" />Option B
              </label>
            </div>

            <!-- Navbar (top) -->
            <div v-else-if="c.name === 'Navbar'" class="showcase__navbar" :data-testid="i === 0 ? `preview-${c.name}` : `preview-${c.name}-${vr.variant}`" :style="styleFor(c.name, vr)">
              <strong>Logo</strong>
              <nav class="showcase__nav-links"><span>Home</span><span>Docs</span><span>Pricing</span></nav>
              <button class="showcase__btn" :style="{ background: 'var(--color-primary)', color: 'var(--color-on-primary)', borderRadius: 'var(--rounded-md)' }">Sign in</button>
            </div>

            <!-- Sidebar: one-level vs multilevel -->
            <div v-else-if="c.name === 'Sidebar'" class="showcase__sidebar" :data-testid="i === 0 ? `preview-${c.name}` : `preview-${c.name}-${vr.variant}`" :style="styleFor(c.name, vr)">
              <div class="showcase__side-item">
                <component :is="sidebarIcon('Dashboard')" v-if="hasGroup('Sidebar', 'itemIcon')" :size="itemIconSize()" :style="itemIconStyle()" aria-hidden="true" />Dashboard
              </div>
              <div class="showcase__side-item">
                <component :is="sidebarIcon('Projects')" v-if="hasGroup('Sidebar', 'itemIcon')" :size="itemIconSize()" :style="itemIconStyle()" aria-hidden="true" />Projects
              </div>
              <template v-if="vr.variant === 'multilevel'">
                <div class="showcase__side-group">
                  <span class="showcase__side-label"><component :is="sidebarIcon('Settings')" v-if="hasGroup('Sidebar', 'itemIcon')" :size="itemIconSize()" :style="itemIconStyle()" aria-hidden="true" />Settings</span>
                  <ChevronDown :size="12" aria-hidden="true" />
                </div>
                <div class="showcase__side-sub">Profile</div>
                <div class="showcase__side-sub">Billing</div>
              </template>
              <div v-else class="showcase__side-item">
                <component :is="sidebarIcon('Settings')" v-if="hasGroup('Sidebar', 'itemIcon')" :size="itemIconSize()" :style="itemIconStyle()" aria-hidden="true" />Settings
              </div>
            </div>

            <div v-else :data-testid="i === 0 ? `preview-${c.name}` : `preview-${c.name}-${vr.variant}`" :style="styleFor(c.name, vr)">{{ sampleText(c.name, vr.variant) }}</div>
          </template>

          <span v-else class="showcase__hidden">hidden</span>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.showcase {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}
.showcase__group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: border-color var(--transition-duration-fast) var(--transition-easing-ease-out);
}
.showcase__group:hover {
  border-color: var(--color-surface-border);
}
.showcase__group--selected {
  border-color: var(--color-primary);
}
.showcase__name {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-family: var(--font-mono);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-on-surface-subtle);
  border-bottom: 1px solid var(--color-surface-border);
  padding-bottom: var(--spacing-xs);
}
.showcase__edit {
  font-size: 10px;
  color: var(--color-primary);
  opacity: 0;
  transition: opacity var(--transition-duration-fast) var(--transition-easing-ease-out);
}
.showcase__group:hover .showcase__edit {
  opacity: 1;
}
.showcase__variants {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-lg);
  align-items: flex-start;
}
.showcase__cell {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-start;
}
.showcase__variant-label {
  font-family: var(--font-sans);
  font-size: 10px;
  color: var(--color-on-surface-subtle);
}
.showcase__card {
  display: flex;
  flex-direction: column;
  min-width: 200px;
}
.showcase__card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.showcase__card-body {
  margin: var(--spacing-xs) 0 0;
  font-size: 13px;
  opacity: 0.8;
}
.showcase__alert {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-sm);
  min-width: 240px;
}
.showcase__alert-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}
.showcase__alert-body span {
  font-size: 13px;
  opacity: 0.85;
}
.showcase__sep {
  width: 100%;
  border: 0;
  border-top: 1px solid currentColor;
  opacity: 0.2;
  margin: var(--spacing-xs) 0;
}
.showcase__x {
  display: inline-flex;
  background: none;
  border: none;
  color: currentColor;
  opacity: 0.6;
  cursor: pointer;
  padding: 0;
}
.showcase__x:hover {
  opacity: 1;
}
.showcase__actions {
  display: flex;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-sm);
}
.showcase__btn {
  font-family: var(--font-sans);
  font-size: 12px;
  padding: 4px 10px;
  border: 1px solid transparent;
  cursor: pointer;
}
.showcase__checkbox-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}
.showcase__checkbox {
  display: inline-block;
}
.showcase__dropdown {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  min-width: 180px;
}
.showcase__radio-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}
.showcase__radio-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: 13px;
}
.showcase__radio {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}
.showcase__radio-dot {
  width: 7px;
  height: 7px;
  border-radius: 9999px;
  background: var(--color-on-primary);
}
.showcase__navbar {
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);
  min-width: 320px;
}
.showcase__nav-links {
  display: flex;
  gap: var(--spacing-md);
  flex: 1;
  font-size: 13px;
  opacity: 0.85;
}
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
.showcase__hidden {
  font-family: var(--font-sans);
  font-size: 11px;
  font-style: italic;
  color: var(--color-on-surface-subtle);
}
button[data-testid],
input[data-testid] {
  cursor: pointer;
  border: 0;
}
</style>
