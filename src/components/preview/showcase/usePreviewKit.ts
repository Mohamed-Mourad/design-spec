import { computed } from 'vue'
import type { CSSProperties } from 'vue'
import { storeToRefs } from 'pinia'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'
import { groupStyle as toGroupStyle, refToVar, resolveComponentStyle } from '@/utils/previewStyle'

/** Props every showcase preview receives from the frame. */
export interface PreviewProps {
  /** Blueprint name, e.g. "Tabs". */
  name: string
  /** Variant being rendered ("default" when the blueprint has none). */
  variant: string
  /** `preview-{Name}` for the first variant, `preview-{Name}-{variant}` after. */
  testid: string
  /** Root style: base ⊕ variant ⊕ reached responsive layers (⊕ hover). */
  rootStyle: CSSProperties
}

/**
 * Token helpers shared by the per-component previews. Everything resolves to
 * `var(--…)` (or a typography token's values), so a token edit repaints live.
 * Suggestions and compound parts are named token sub-groups on the blueprint.
 */
export function usePreviewKit() {
  const store = useDesignSystemStore()
  const { schema, viewportWidth } = storeToRefs(store)

  const bpOf = (n: string) => schema.value.componentBlueprints[n]
  const group = (n: string, k: string) => bpOf(n)?.tokens[k] as Record<string, unknown> | undefined
  const hasGroup = (n: string, k: string) => !!bpOf(n)?.tokens[k]

  /** One prop of a sub-group as CSS, or the fallback when unset. */
  function groupVal(n: string, k: string, prop: string, fallback: string): string {
    const g = group(n, k)
    return g && g[prop] != null ? refToVar(g[prop]) : fallback
  }

  /** A whole sub-group (e.g. Tabs `indicator`) as inline CSS. */
  function groupStyle(n: string, k: string): CSSProperties {
    return toGroupStyle(schema.value, group(n, k))
  }

  /** A named state group (e.g. Radio `checked`) layered over the root style. */
  function stateStyle(n: string, g: string): CSSProperties {
    const bp = bpOf(n)
    return bp ? resolveComponentStyle(schema.value, bp, viewportWidth.value, undefined, [g]).style : {}
  }

  function sepStyle(n: string): CSSProperties {
    return { borderTop: `${groupVal(n, 'separator', 'borderWidth', '1px')} solid ${groupVal(n, 'separator', 'borderColor', 'currentColor')}` }
  }
  function closeStyle(n: string): CSSProperties {
    return { color: groupVal(n, 'close', 'textColor', 'currentColor') }
  }
  function closeSize(n: string): number {
    return parseInt(String(group(n, 'close')?.size ?? '')) || 16
  }
  function actionLabel(n: string, which: 'cancelLabel' | 'confirmLabel', fallback: string): string {
    return (group(n, 'actions')?.[which] as string) || fallback
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

  /** A prop's default from the blueprint (the editor's "prop defaults" drive the preview). */
  function propDefault<T>(n: string, prop: string, fallback: T): T {
    const v = bpOf(n)?.props[prop]?.default
    return v === undefined || v === null ? fallback : (v as T)
  }

  return {
    schema,
    viewportWidth: computed(() => viewportWidth.value),
    bpOf,
    group,
    hasGroup,
    groupVal,
    groupStyle,
    stateStyle,
    sepStyle,
    closeStyle,
    closeSize,
    actionLabel,
    actionBtnStyle,
    propDefault,
  }
}
