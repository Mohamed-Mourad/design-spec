<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'
import SaveToDashboardButton from '@/components/sync/SaveToDashboardButton.vue'
import type { ExportConfig } from '@/types/schema'
import type { Framework } from '@/types/compiler'

// Settings → Export: Layer 1 of §17, the code-generation config. It lives in
// the active workspace's `schema.export` — the same object the workspace's
// framework selector edits — so this is a fuller editor over it, not a copy.
// Every change is one undo step (store.updateExport).
//
// On the dashboard this layer is the developer's: a plain `design-spec sync`
// keeps their local export config, and only `sync --force` takes this one.

const store = useDesignSystemStore()
const { schema } = storeToRefs(store)
const exp = computed(() => schema.value.export)

const STACKS: { id: Framework; label: string }[] = [
  { id: 'react-tailwind', label: 'React · Tailwind' },
  { id: 'react-css', label: 'React · CSS' },
  { id: 'vue-tailwind', label: 'Vue · Tailwind' },
  { id: 'vue-css', label: 'Vue · CSS' },
  { id: 'flutter', label: 'Flutter' },
]

const NAMING: { id: ExportConfig['webNamingConvention']; example: string }[] = [
  { id: 'kebab-case', example: 'color-primary' },
  { id: 'camelCase', example: 'colorPrimary' },
  { id: 'snake_case', example: 'color_primary' },
  { id: 'SCREAMING_SNAKE', example: 'COLOR_PRIMARY' },
]

const FLUTTER_NAMING: { id: ExportConfig['flutterNaming']; label: string; example: string }[] = [
  { id: 'prefixed-class', label: 'Prefixed class', example: 'AppColors.primary' },
  { id: 'snake_const', label: 'Snake const', example: 'c_primary' },
  { id: 'raw', label: 'Raw k-const', example: 'kColorPrimary' },
]

function toggleStack(id: Framework, on: boolean) {
  const current = new Set(exp.value.frameworks)
  if (on) current.add(id)
  else if (current.size > 1) current.delete(id)
  else return // at least one stack always ships
  store.updateExport({ frameworks: STACKS.map((s) => s.id).filter((s) => current.has(s)) })
}

function onText(field: 'cssVariablePrefix' | 'tailwindClassPrefix' | 'fontSourceUrl', e: Event) {
  const value = (e.target as HTMLInputElement).value.trim()
  if ((exp.value[field] ?? '') === value) return
  store.updateExport({ [field]: value })
}

function onSelect<K extends keyof ExportConfig>(field: K, e: Event) {
  store.updateExport({ [field]: (e.target as HTMLSelectElement).value } as Partial<ExportConfig>)
}

const cssVarExample = computed(() => `--${exp.value.cssVariablePrefix}color-primary`)
const twExample = computed(() => `${exp.value.tailwindClassPrefix}text-primary`)
</script>

<template>
  <section class="card" data-testid="export-settings">
    <h2 class="card__title">Export</h2>
    <p class="card__text">
      How <span class="mono">{{ schema.name }}</span> compiles to code. These settings belong to the
      active workspace and ship with it to the dashboard.
    </p>
    <p class="note" data-testid="export-sync-note">
      Developers get these with <span class="mono">design-spec sync --force</span>; a plain
      <span class="mono">sync</span> keeps theirs.
    </p>

    <fieldset class="field">
      <legend class="field__label">Frameworks</legend>
      <div class="stacks">
        <label v-for="s in STACKS" :key="s.id" class="stack">
          <input
            type="checkbox"
            :data-testid="`export-stack-${s.id}`"
            :checked="exp.frameworks.includes(s.id)"
            :disabled="exp.frameworks.length === 1 && exp.frameworks.includes(s.id)"
            @change="toggleStack(s.id, ($event.target as HTMLInputElement).checked)"
          />
          {{ s.label }}
        </label>
      </div>
    </fieldset>

    <label class="field">
      <span class="field__label">Web naming convention</span>
      <select
        class="input"
        data-testid="export-web-naming"
        :value="exp.webNamingConvention"
        @change="onSelect('webNamingConvention', $event)"
      >
        <option v-for="n in NAMING" :key="n.id" :value="n.id">{{ n.id }} — {{ n.example }}</option>
      </select>
    </label>

    <div class="row">
      <label class="field">
        <span class="field__label">CSS variable prefix</span>
        <input
          class="input mono-input"
          data-testid="export-css-prefix"
          placeholder="none"
          spellcheck="false"
          :value="exp.cssVariablePrefix"
          @change="onText('cssVariablePrefix', $event)"
        />
        <span class="field__hint mono">{{ cssVarExample }}</span>
      </label>
      <label class="field">
        <span class="field__label">Tailwind class prefix</span>
        <input
          class="input mono-input"
          data-testid="export-tw-prefix"
          placeholder="none"
          spellcheck="false"
          :value="exp.tailwindClassPrefix"
          @change="onText('tailwindClassPrefix', $event)"
        />
        <span class="field__hint mono">{{ twExample }}</span>
      </label>
    </div>

    <label class="field">
      <span class="field__label">Flutter naming</span>
      <select
        class="input"
        data-testid="export-flutter-naming"
        :value="exp.flutterNaming"
        @change="onSelect('flutterNaming', $event)"
      >
        <option v-for="n in FLUTTER_NAMING" :key="n.id" :value="n.id">{{ n.label }} — {{ n.example }}</option>
      </select>
    </label>

    <div class="row">
      <label class="field">
        <span class="field__label">Font loading</span>
        <select
          class="input"
          data-testid="export-font-loading"
          :value="exp.fontLoading"
          @change="onSelect('fontLoading', $event)"
        >
          <option value="auto">Automatic — emit the font import</option>
          <option value="manual">Manual — I load fonts myself</option>
        </select>
      </label>
      <label class="field">
        <span class="field__label">Font source</span>
        <select
          class="input"
          data-testid="export-font-source"
          :value="exp.fontSource"
          @change="onSelect('fontSource', $event)"
        >
          <option value="google">Google Fonts</option>
          <option value="bunny">Bunny Fonts</option>
          <option value="custom">Custom URL</option>
        </select>
      </label>
    </div>

    <label v-if="exp.fontSource === 'custom'" class="field">
      <span class="field__label">Custom font URL</span>
      <input
        class="input mono-input"
        type="url"
        data-testid="export-font-url"
        placeholder="https://fonts.example.com/css?family=…"
        spellcheck="false"
        :value="exp.fontSourceUrl ?? ''"
        @change="onText('fontSourceUrl', $event)"
      />
    </label>

    <div class="card__actions">
      <SaveToDashboardButton />
    </div>
  </section>
</template>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  background-color: var(--color-surface-default);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-lg);
}
.card__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 400;
  color: var(--color-on-surface);
}
.card__text {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 13px;
  line-height: 1.6;
  color: var(--color-on-surface-muted);
}
.card__actions {
  display: flex;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
}
.note {
  margin: 0;
  padding: var(--spacing-sm);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  background-color: var(--color-surface-sunken);
  font-family: var(--font-sans);
  font-size: 12px;
  line-height: 1.55;
  color: var(--color-on-surface-muted);
}
.mono {
  font-family: var(--font-mono);
  color: var(--color-on-surface);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: none;
}
.field__label {
  padding: 0;
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 600;
  color: var(--color-on-surface);
}
.field__hint {
  font-size: 11px;
  color: var(--color-on-surface-subtle);
}
.row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--spacing-md);
}

.input {
  min-height: 34px;
  padding: 0 var(--spacing-sm);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  background-color: var(--color-surface-sunken);
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--color-on-surface);
}
.input:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--color-interactive-focus-ring);
}
.mono-input {
  font-family: var(--font-mono);
  font-size: 12px;
}

.stacks {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}
.stack {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 34px;
  padding: 0 var(--spacing-sm);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  font-family: var(--font-sans);
  font-size: 12px;
  color: var(--color-on-surface);
  cursor: pointer;
}
.stack input {
  accent-color: var(--color-primary);
}
</style>
