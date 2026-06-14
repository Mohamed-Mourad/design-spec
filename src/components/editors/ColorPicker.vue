<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { Pipette } from '@lucide/vue'
import { hexToRgba, rgbaToHex, rgbToHsv, hsvToRgb, isHexColor, normalizeHex, parseCssColor } from '@/utils/colorUtils'

// Figma-style color picker: saturation/value pad, hue + alpha sliders, hex
// field, and an eyedropper where the browser supports it. Emits an #rrggbb(aa)
// string. Operates on concrete colors only (the editor resolves token refs).
const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [hex: string] }>()

const h = ref(0)
const s = ref(1)
const v = ref(1)
const a = ref(1)

const padEl = ref<HTMLElement | null>(null)
const hueEl = ref<HTMLElement | null>(null)
const alphaEl = ref<HTMLElement | null>(null)

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

const rgb = computed(() => hsvToRgb(h.value, s.value, v.value))
const currentHex = computed(() => rgbaToHex({ ...rgb.value, a: a.value }))
const opaqueHex = computed(() => rgbaToHex({ ...rgb.value, a: 1 }))
const hueColor = computed(() => {
  const c = hsvToRgb(h.value, 1, 1)
  return rgbaToHex({ r: c.r, g: c.g, b: c.b, a: 1 })
})

// Set true while we write h/s/v/a from an external value, so the [h,s,v,a]
// watch doesn't echo that back out as a user edit.
let internalSync = false

function syncFromModel(hex: string) {
  if (!isHexColor(hex)) return
  const rgba = hexToRgba(hex)
  const hsv = rgbToHsv(rgba)
  internalSync = true
  // Preserve hue when the color is greyscale (s/v collapse hue to 0).
  if (hsv.s !== 0) h.value = hsv.h
  s.value = hsv.s
  v.value = hsv.v
  a.value = rgba.a
}

onMounted(() => syncFromModel(props.modelValue))
watch(
  () => props.modelValue,
  (nv) => {
    if (nv !== currentHex.value) syncFromModel(nv)
  },
)
watch([h, s, v, a], () => {
  if (internalSync) {
    internalSync = false
    return
  }
  emit('update:modelValue', currentHex.value)
})

function startDrag(e: PointerEvent, el: HTMLElement | null, onMove: (xf: number, yf: number) => void) {
  if (!el) return
  const rect = el.getBoundingClientRect()
  const apply = (ev: PointerEvent) => {
    onMove(clamp((ev.clientX - rect.left) / rect.width, 0, 1), clamp((ev.clientY - rect.top) / rect.height, 0, 1))
  }
  apply(e)
  const up = () => {
    window.removeEventListener('pointermove', apply)
    window.removeEventListener('pointerup', up)
  }
  window.addEventListener('pointermove', apply)
  window.addEventListener('pointerup', up)
}

const onPad = (e: PointerEvent) =>
  startDrag(e, padEl.value, (x, y) => {
    s.value = x
    v.value = 1 - y
  })
const onHue = (e: PointerEvent) => startDrag(e, hueEl.value, (x) => (h.value = x * 360))
const onAlpha = (e: PointerEvent) => startDrag(e, alphaEl.value, (x) => (a.value = x))

const hexField = ref('')
watch(currentHex, (c) => (hexField.value = c), { immediate: true })
function commitHex() {
  const next = normalizeHex(hexField.value.startsWith('#') ? hexField.value : `#${hexField.value}`)
  if (isHexColor(next)) syncFromModel(next)
  else hexField.value = currentHex.value
}

const hasEyeDropper = typeof window !== 'undefined' && 'EyeDropper' in window

function setHex(hex: string) {
  syncFromModel(hex)
  emit('update:modelValue', currentHex.value)
}

async function pickFromScreen() {
  try {
    // @ts-expect-error — EyeDropper isn't in the DOM lib yet.
    const result = await new window.EyeDropper().open()
    if (result?.sRGBHex) setHex(result.sRGBHex)
  } catch {
    // user cancelled
  }
}

// Cross-browser fallback: a full-screen overlay tracks the cursor, showing a
// magnifier lens with the live color under the pointer; a click commits it.
const sampling = ref(false)
const lensX = ref(0)
const lensY = ref(0)
const lensColor = ref('#000000')

/** Effective background color at an element, walking up to the first opaque one. */
function sampleColorAt(start: Element | null): string | null {
  let el = start as HTMLElement | null
  while (el) {
    const rgba = parseCssColor(getComputedStyle(el).backgroundColor)
    if (rgba && rgba.a > 0) return rgbaToHex({ ...rgba, a: 1 })
    el = el.parentElement
  }
  return null
}

/** Read what's under (x, y) with the overlay momentarily hidden from hit-testing. */
function colorUnder(overlay: HTMLElement, x: number, y: number): string | null {
  overlay.style.visibility = 'hidden'
  const el = document.elementFromPoint(x, y)
  overlay.style.visibility = 'visible'
  return sampleColorAt(el)
}

let moveRaf = 0
function onSampleMove(e: MouseEvent) {
  const overlay = e.currentTarget as HTMLElement
  const x = e.clientX
  const y = e.clientY
  if (moveRaf) return
  moveRaf = requestAnimationFrame(() => {
    moveRaf = 0
    lensX.value = x
    lensY.value = y
    const c = colorUnder(overlay, x, y)
    if (c) lensColor.value = c
  })
}

function onSampleClick(e: MouseEvent) {
  e.stopPropagation() // keep the picker open (don't trigger its outside-click close)
  const c = colorUnder(e.currentTarget as HTMLElement, e.clientX, e.clientY)
  sampling.value = false
  if (c) setHex(c)
}

function onSampleKey(e: KeyboardEvent) {
  if (e.key === 'Escape') sampling.value = false
}
watch(sampling, (on) => {
  if (on) document.addEventListener('keydown', onSampleKey)
  else document.removeEventListener('keydown', onSampleKey)
})

function pickColor() {
  if (hasEyeDropper) void pickFromScreen()
  else {
    lensColor.value = currentHex.value
    sampling.value = true
  }
}
</script>

<template>
  <div class="cp" @click.stop>
    <div
      ref="padEl"
      class="cp__pad"
      :style="{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent), ${hueColor}` }"
      @pointerdown="onPad"
    >
      <span class="cp__pad-thumb" :style="{ left: `${s * 100}%`, top: `${(1 - v) * 100}%`, background: opaqueHex }" />
    </div>

    <div class="cp__sliders">
      <div ref="hueEl" class="cp__slider cp__slider--hue" @pointerdown="onHue">
        <span class="cp__slider-thumb" :style="{ left: `${(h / 360) * 100}%`, background: hueColor }" />
      </div>
      <div
        ref="alphaEl"
        class="cp__slider cp__slider--alpha"
        :style="{ '--cp-opaque': opaqueHex }"
        @pointerdown="onAlpha"
      >
        <span class="cp__slider-thumb" :style="{ left: `${a * 100}%`, background: currentHex }" />
      </div>
    </div>

    <div class="cp__row">
      <span class="cp__preview" :style="{ background: currentHex }" />
      <input v-model="hexField" class="cp__hex" spellcheck="false" aria-label="Hex value" @blur="commitHex" @keydown.enter="commitHex" />
      <button
        class="cp__eyedropper"
        aria-label="Pick a color"
        :title="hasEyeDropper ? 'Pick a color from anywhere on screen' : 'Pick a color from the preview'"
        @click="pickColor"
      >
        <Pipette :size="14" aria-hidden="true" />
      </button>
    </div>
  </div>

  <Teleport to="body">
    <div
      v-if="sampling"
      class="cp__sample-overlay"
      @mousemove="onSampleMove"
      @click="onSampleClick"
    >
      <div
        class="cp__lens"
        :style="{ left: `${lensX}px`, top: `${lensY}px`, '--lens-color': lensColor }"
      >
        <span class="cp__lens-reticle" />
        <span class="cp__lens-hex">{{ lensColor }}</span>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.cp {
  width: 220px;
  padding: var(--spacing-sm);
  background-color: var(--color-surface-overlay);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}
.cp__pad {
  position: relative;
  width: 100%;
  height: 140px;
  border-radius: var(--radius-sm);
  cursor: crosshair;
  touch-action: none;
}
.cp__pad-thumb {
  position: absolute;
  width: 12px;
  height: 12px;
  border-radius: var(--radius-full);
  border: 2px solid #fff;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.4);
  transform: translate(-50%, -50%);
  pointer-events: none;
}
.cp__sliders {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}
.cp__slider {
  position: relative;
  height: 12px;
  border-radius: var(--radius-full);
  cursor: pointer;
  touch-action: none;
}
.cp__slider--hue {
  background: linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00);
}
.cp__slider--alpha {
  background-image: linear-gradient(to right, transparent, var(--cp-opaque)),
    linear-gradient(45deg, #888 25%, transparent 25%, transparent 75%, #888 75%),
    linear-gradient(45deg, #888 25%, #ccc 25%, #ccc 75%, #888 75%);
  background-size: 100% 100%, 8px 8px, 8px 8px;
  background-position: 0 0, 0 0, 4px 4px;
}
.cp__slider-thumb {
  position: absolute;
  top: 50%;
  width: 14px;
  height: 14px;
  border-radius: var(--radius-full);
  border: 2px solid #fff;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.4);
  transform: translate(-50%, -50%);
  pointer-events: none;
}
.cp__row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}
.cp__preview {
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-surface-border);
  flex-shrink: 0;
}
.cp__hex {
  flex: 1;
  min-width: 0;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--color-on-surface);
  background-color: var(--color-surface-sunken);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  padding: 4px 6px;
}
.cp__eyedropper {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  color: var(--color-on-surface-muted);
  background-color: var(--color-surface-raised);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
}
.cp__eyedropper:hover:not(:disabled) {
  color: var(--color-on-surface);
}
.cp__eyedropper:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>

<style>
/* Teleported to body — must be unscoped. */
.cp__sample-overlay {
  position: fixed;
  inset: 0;
  z-index: 2147483646;
  cursor: crosshair;
  background: transparent;
}
.cp__lens {
  position: fixed;
  width: 88px;
  height: 88px;
  transform: translate(-50%, -50%);
  border-radius: 9999px;
  background: var(--lens-color);
  border: 3px solid #fff;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.5), 0 4px 12px rgba(0, 0, 0, 0.4);
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
}
.cp__lens-reticle {
  width: 14px;
  height: 14px;
  border: 2px solid #fff;
  border-radius: 2px;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.6);
  mix-blend-mode: difference;
}
.cp__lens-hex {
  position: absolute;
  top: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  font-family: "DM Mono", monospace;
  font-size: 11px;
  color: #fff;
  background: rgba(0, 0, 0, 0.8);
  border-radius: 4px;
  padding: 2px 6px;
  white-space: nowrap;
}
</style>
