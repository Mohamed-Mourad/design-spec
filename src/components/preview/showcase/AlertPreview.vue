<script setup lang="ts">
import { computed } from 'vue'
import type { CSSProperties, Component } from 'vue'
import { Info, CircleCheck, TriangleAlert, CircleAlert, X } from '@lucide/vue'
import { matchStatus } from '@/utils/statusMatch'
import { usePreviewKit, type PreviewProps } from './usePreviewKit'

const props = defineProps<PreviewProps>()
const { bpOf, hasGroup, groupVal, sepStyle, closeStyle, closeSize, actionLabel, actionBtnStyle } = usePreviewKit()

// Icon + title/message driven by the blueprint's prop defaults.
const cfg = computed(() => {
  const bp = bpOf(props.name)
  const icon = (bp?.tokens.icon ?? {}) as Record<string, unknown>
  return {
    placement: (bp?.props.iconPlacement?.default as string) ?? 'leading',
    content: (bp?.props.content?.default as string) ?? 'title-message',
    align: (icon.align as string) ?? 'title',
    size: parseInt(String(icon.size ?? '')) || 16,
  }
})
const ICONS: Record<string, Component> = { info: Info, success: CircleCheck, warning: TriangleAlert, error: CircleAlert }
const TITLES: Record<string, string> = { info: 'Information', success: 'Success', warning: 'Warning', error: 'Error' }
const icon = computed(() => ICONS[matchStatus(props.variant) ?? 'info'] ?? Info)
const title = computed(() => TITLES[matchStatus(props.variant) ?? ''] ?? props.variant)

function vsepStyle(): CSSProperties {
  return { borderLeft: `${groupVal(props.name, 'iconSep', 'borderWidth', '1px')} solid ${groupVal(props.name, 'iconSep', 'borderColor', 'currentColor')}` }
}
</script>

<template>
  <!-- Alert: icon + title/message, optional separator, actions, close -->
  <div
    class="showcase__alert"
    :class="{ 'showcase__alert--center': cfg.align === 'center', 'showcase__alert--above': cfg.align === 'above' }"
    :data-testid="testid"
    :style="rootStyle"
  >
    <component
      :is="icon"
      v-if="cfg.placement === 'leading' || (cfg.align === 'above' && cfg.placement !== 'none')"
      :size="cfg.size"
      :style="{ color: rootStyle.borderColor }"
      aria-hidden="true"
    />
    <span v-if="cfg.placement === 'leading' && cfg.align !== 'above' && hasGroup(name, 'iconSep')" class="showcase__vsep" :style="vsepStyle()" />

    <div class="showcase__alert-body">
      <strong v-if="cfg.content === 'title-message'">{{ title }}</strong>
      <hr v-if="hasGroup(name, 'separator')" class="showcase__sep" :style="sepStyle(name)" />
      <span>Something needs your attention.</span>
      <div v-if="hasGroup(name, 'actions')" class="showcase__actions">
        <button class="showcase__btn" :style="actionBtnStyle(name, 'cancel')">{{ actionLabel(name, 'cancelLabel', 'Cancel') }}</button>
        <button class="showcase__btn" :style="actionBtnStyle(name, 'confirm')">{{ actionLabel(name, 'confirmLabel', 'Confirm') }}</button>
      </div>
    </div>

    <span v-if="cfg.placement === 'trailing' && cfg.align !== 'above' && hasGroup(name, 'iconSep')" class="showcase__vsep" :style="vsepStyle()" />
    <component
      :is="icon"
      v-if="cfg.placement === 'trailing' && cfg.align !== 'above'"
      :size="cfg.size"
      :style="{ color: rootStyle.borderColor }"
      aria-hidden="true"
    />
    <button v-if="hasGroup(name, 'close')" class="showcase__x" :style="closeStyle(name)" aria-label="Close"><X :size="closeSize(name)" /></button>
  </div>
</template>

<style scoped>
.showcase__alert {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-sm);
  min-width: 240px;
}
.showcase__alert--center {
  align-items: center;
}
.showcase__alert--above {
  flex-direction: column;
  align-items: flex-start;
}
.showcase__vsep {
  align-self: stretch;
  min-height: 100%;
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
</style>
