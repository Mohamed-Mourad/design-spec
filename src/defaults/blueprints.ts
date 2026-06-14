import type { ComponentBlueprint } from '@/types/schema'

// Tier 1 component blueprints, pre-loaded into the default schema. Each carries
// base style tokens (referenced via {token} so edits cascade) plus, where it
// matters, mobile-first responsive overrides. These drive SKILL.md, the code
// stubs, and the live showcase.

export const tier1Blueprints: Record<string, ComponentBlueprint> = {
  Button: {
    name: 'Button',
    description: 'Primary action trigger. The most-referenced component in any UI.',
    category: 'action',
    variants: ['primary', 'secondary', 'ghost', 'destructive'],
    sizes: ['sm', 'md', 'lg'],
    states: ['default', 'hover', 'active', 'disabled', 'loading'],
    anatomy: ['root', 'label', 'icon', 'spinner'],
    props: {
      variant: { type: 'enum', values: ['primary', 'secondary', 'ghost', 'destructive'], default: 'primary' },
      size: { type: 'enum', values: ['sm', 'md', 'lg'], default: 'md' },
      disabled: { type: 'boolean', default: false },
      loading: { type: 'boolean', default: false },
      label: { type: 'string', required: true, description: 'Button text' },
    },
    tokens: {
      base: {
        backgroundColor: '{colors.primary}',
        textColor: '{colors.on-primary}',
        typography: '{typography.label-lg}',
        rounded: '{rounded.md}',
        paddingX: '{spacing.md}',
        paddingY: '{spacing.sm}',
      },
      secondary: {
        backgroundColor: '{colors.surface-raised}',
        textColor: '{colors.on-surface}',
        borderColor: '{colors.surface-border}',
        borderWidth: '1px',
      },
      ghost: {
        textColor: '{colors.on-surface-muted}',
      },
      destructive: {
        backgroundColor: '{colors.status-error}',
        textColor: '{colors.on-primary}',
      },
    },
    examples: [
      { label: 'Primary', props: { variant: 'primary', label: 'Save changes' } },
      { label: 'Loading', props: { variant: 'primary', loading: true, label: 'Saving…' } },
    ],
    dosDonts: {
      dos: ['Use one primary button per view', 'Lead with a verb in the label'],
      donts: ["Don't use a raw hex for the background — reference {colors.primary}"],
    },
  },

  Input: {
    name: 'Input',
    description: 'Single-line text field with label, helper text, and error message.',
    category: 'form',
    variants: ['default'],
    sizes: ['md'],
    states: ['default', 'focus', 'error', 'disabled'],
    anatomy: ['root', 'label', 'field', 'helper', 'error'],
    props: {
      type: { type: 'enum', values: ['text', 'password', 'search'], default: 'text' },
      placeholder: { type: 'string' },
      disabled: { type: 'boolean', default: false },
      error: { type: 'string', description: 'Error message; renders the error state' },
    },
    tokens: {
      base: {
        backgroundColor: '{colors.surface-sunken}',
        textColor: '{colors.on-surface}',
        borderColor: '{colors.surface-border}',
        borderWidth: '1px',
        rounded: '{rounded.md}',
        padding: '{spacing.sm}',
        typography: '{typography.body-md}',
      },
    },
    examples: [{ label: 'Default', props: { type: 'text', placeholder: 'you@example.com' } }],
  },

  Card: {
    name: 'Card',
    description: 'Elevated container for grouped content. Padding grows on larger viewports.',
    category: 'layout',
    variants: ['default', 'interactive', 'outlined'],
    sizes: [],
    states: ['default', 'hover'],
    anatomy: ['root', 'header', 'body', 'footer'],
    props: {
      variant: { type: 'enum', values: ['default', 'interactive', 'outlined'], default: 'default' },
    },
    tokens: {
      base: {
        backgroundColor: '{colors.surface-raised}',
        rounded: '{rounded.lg}',
        padding: '{spacing.md}',
        shadow: '{shadows.sm}',
        borderColor: '{colors.surface-border-subtle}',
        borderWidth: '1px',
        responsive: {
          md: { padding: '{spacing.lg}' },
          lg: { padding: '{spacing.xl}' },
        },
      },
    },
    examples: [{ label: 'Default', props: { variant: 'default' } }],
  },

  Badge: {
    name: 'Badge',
    description: 'Compact status or category label.',
    category: 'data',
    variants: ['neutral', 'success', 'warning', 'error', 'info'],
    sizes: ['sm', 'md'],
    states: ['default'],
    anatomy: ['root', 'label'],
    props: {
      variant: { type: 'enum', values: ['neutral', 'success', 'warning', 'error', 'info'], default: 'neutral' },
    },
    tokens: {
      base: {
        backgroundColor: '{colors.surface-overlay}',
        textColor: '{colors.on-surface-muted}',
        rounded: '{rounded.full}',
        paddingX: '{spacing.sm}',
        paddingY: '{spacing.xs}',
        typography: '{typography.label-sm}',
      },
      success: { backgroundColor: '{colors.status-success}', textColor: '{colors.on-primary}' },
      warning: { backgroundColor: '{colors.status-warning}', textColor: '{colors.on-primary}' },
      error: { backgroundColor: '{colors.status-error}', textColor: '{colors.on-primary}' },
      info: { backgroundColor: '{colors.status-info}', textColor: '{colors.on-primary}' },
    },
    examples: [{ label: 'Success', props: { variant: 'success' } }],
  },

  Alert: {
    name: 'Alert',
    description: 'Inline contextual feedback banner. Color, border, and icon follow the status.',
    category: 'feedback',
    variants: ['info', 'success', 'warning', 'error'],
    sizes: [],
    states: ['default'],
    anatomy: ['root', 'icon', 'title', 'description', 'close'],
    props: {
      variant: { type: 'enum', values: ['info', 'success', 'warning', 'error'], default: 'info' },
      iconPlacement: {
        type: 'enum',
        values: ['leading', 'trailing', 'none'],
        default: 'leading',
        description: 'Where the status icon sits',
      },
      content: {
        type: 'enum',
        values: ['title-message', 'message'],
        default: 'title-message',
        description: 'Title + message, or message only',
      },
      dismissible: { type: 'boolean', default: false },
    },
    tokens: {
      base: {
        backgroundColor: '{colors.surface-raised}',
        textColor: '{colors.on-surface}',
        borderColor: '{colors.surface-border}',
        borderWidth: '1px',
        rounded: '{rounded.md}',
        padding: '{spacing.md}',
        typography: '{typography.body-md}',
      },
      info: { backgroundColor: '{colors.status-info-surface}', borderColor: '{colors.status-info}' },
      success: { backgroundColor: '{colors.status-success-surface}', borderColor: '{colors.status-success}' },
      warning: { backgroundColor: '{colors.status-warning-surface}', borderColor: '{colors.status-warning}' },
      error: { backgroundColor: '{colors.status-error-surface}', borderColor: '{colors.status-error}' },
    },
    examples: [
      { label: 'Info (title + message)', props: { variant: 'info', iconPlacement: 'leading', content: 'title-message' } },
      { label: 'Error (message only)', props: { variant: 'error', content: 'message' } },
    ],
  },

  Checkbox: {
    name: 'Checkbox',
    description: 'Binary or indeterminate selection control with optional label.',
    category: 'form',
    variants: ['default'],
    sizes: ['md'],
    states: ['unchecked', 'checked', 'indeterminate', 'disabled'],
    anatomy: ['root', 'box', 'check', 'label'],
    props: {
      checked: { type: 'boolean', default: false },
      indeterminate: { type: 'boolean', default: false },
      label: { type: 'string' },
    },
    tokens: {
      base: {
        backgroundColor: '{colors.surface-sunken}',
        borderColor: '{colors.surface-border}',
        borderWidth: '1px',
        rounded: '{rounded.sm}',
        size: '18px',
      },
      checked: { backgroundColor: '{colors.primary}', borderColor: '{colors.primary}' },
    },
    examples: [{ label: 'Checked', props: { checked: true, label: 'Subscribe' } }],
  },

  Tooltip: {
    name: 'Tooltip',
    description: 'Small floating label revealed on hover or focus.',
    category: 'feedback',
    variants: ['default'],
    sizes: [],
    states: ['default'],
    anatomy: ['root', 'arrow', 'label'],
    props: {
      placement: { type: 'enum', values: ['top', 'right', 'bottom', 'left'], default: 'top' },
      label: { type: 'string', required: true },
    },
    tokens: {
      base: {
        backgroundColor: '{colors.surface-overlay}',
        textColor: '{colors.on-surface}',
        rounded: '{rounded.sm}',
        padding: '{spacing.sm}',
        shadow: '{shadows.lg}',
        typography: '{typography.label-md}',
      },
    },
    examples: [{ label: 'Top', props: { placement: 'top', label: 'Copy to clipboard' } }],
  },
}
