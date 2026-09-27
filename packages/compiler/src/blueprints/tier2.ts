// blueprints/tier2.ts — Tier 2 ("MVP extended") component blueprints.
//
// Plain data on the shared `ComponentBlueprint` contract, so the web workspace,
// the CLI, and the golden tests all read one copy. Colors, spacing, radii,
// shadows and type are always `{group.token}` refs against the default palette
// (surface-* / on-surface-* / status-*); only dimensions no token scale covers
// (a bar height, a panel width, an icon size) are literals.
//
// Compound parts (a tab indicator, table header, drawer overlay) are named token
// sub-groups beside `base` and the variants, the same way Tier 1's Alert carries
// `icon`. The component stubs emit only `base`, the variants, and `responsive`;
// sub-groups feed DESIGN.md, SKILL.md, MCP, and the live showcase.
//
// `responsive` is mobile-first: `base` is the small-screen layout and each
// breakpoint override's `layout` describes what changes once it is reached.

import type { ComponentBlueprint } from '../types/schema.js'

export const tier2Blueprints: Record<string, ComponentBlueprint> = {
  Navbar: {
    name: 'Navbar',
    description: 'Top navigation bar with brand, links, and actions. Links collapse behind a menu toggle on small screens.',
    category: 'navigation',
    variants: ['default'],
    sizes: [],
    states: ['default', 'menu-open'],
    anatomy: ['root', 'brand', 'links', 'actions', 'menu-toggle'],
    props: {
      sticky: { type: 'boolean', default: true },
      brand: { type: 'string', default: 'Logo', description: 'Brand name or logo alt text' },
    },
    tokens: {
      base: {
        backgroundColor: '{colors.surface-default}',
        textColor: '{colors.on-surface}',
        borderColor: '{colors.surface-border}',
        borderWidth: '1px',
        paddingX: '{spacing.md}',
        paddingY: '{spacing.sm}',
        shadow: '{shadows.sm}',
      },
      link: { textColor: '{colors.on-surface-muted}', typography: '{typography.label-md}' },
      linkActive: { textColor: '{colors.primary}' },
    },
    responsive: {
      md: {
        layout: 'Links render inline and the menu toggle is hidden; below md the links collapse behind the toggle.',
        tokens: { paddingX: '{spacing.lg}' },
      },
    },
    examples: [{ label: 'Default', props: { sticky: true, brand: 'Acme' } }],
    dosDonts: {
      dos: ['Mark the current page link with aria-current="page"', 'Give the menu toggle aria-expanded + aria-controls'],
      donts: ["Don't hide primary navigation on mobile without a toggle"],
    },
  },

  Sidebar: {
    name: 'Sidebar',
    description: 'Vertical navigation. One-level (flat) or multilevel (nested, collapsible groups). Collapses to an icon rail on small screens.',
    category: 'navigation',
    variants: ['one-level', 'multilevel'],
    sizes: [],
    states: ['default', 'collapsed'],
    anatomy: ['root', 'item', 'group', 'sub-item', 'collapse-toggle'],
    props: {
      collapsed: { type: 'boolean', default: false },
      collapsible: { type: 'boolean', default: true, description: 'Show the collapse toggle' },
    },
    tokens: {
      base: {
        backgroundColor: '{colors.surface-default}',
        textColor: '{colors.on-surface}',
        borderColor: '{colors.surface-border}',
        borderWidth: '1px',
        paddingX: '{spacing.sm}',
        paddingY: '{spacing.sm}',
        rounded: '{rounded.md}',
        // No dimension token fits a rail width (spacing tops out at 96px).
        width: '220px',
      },
      activeItem: {
        backgroundColor: '{colors.surface-raised}',
        textColor: '{colors.primary}',
        rounded: '{rounded.sm}',
      },
      collapsed: { width: '56px' },
    },
    responsive: {
      md: {
        layout: 'Expanded rail with labels; below md the sidebar collapses to an icon rail.',
      },
    },
    examples: [
      { label: 'One level', props: {} },
      { label: 'Multilevel', props: {} },
    ],
    dosDonts: {
      dos: ['Toggle nested groups with a button carrying aria-expanded', 'Keep labels available as tooltips or aria-label when collapsed'],
      donts: ["Don't nest deeper than two levels"],
    },
  },

  Tabs: {
    name: 'Tabs',
    description: 'Switches between related panels in place. Line, pill, or contained; horizontal or vertical.',
    category: 'navigation',
    variants: ['line', 'pill', 'contained'],
    sizes: [],
    states: ['default', 'hover', 'selected', 'disabled'],
    anatomy: ['root', 'tablist', 'tab', 'indicator', 'panel'],
    props: {
      variant: { type: 'enum', values: ['line', 'pill', 'contained'], default: 'line' },
      orientation: { type: 'enum', values: ['horizontal', 'vertical'], default: 'horizontal' },
      children: { type: 'slot', description: 'Tab list and panels' },
    },
    tokens: {
      base: {
        textColor: '{colors.on-surface-muted}',
        typography: '{typography.label-md}',
      },
      line: { borderColor: '{colors.surface-border}', borderWidth: '1px' },
      pill: {},
      contained: {
        backgroundColor: '{colors.surface-raised}',
        rounded: '{rounded.lg}',
        padding: '{spacing.xs}',
      },
      tab: { paddingX: '{spacing.md}', paddingY: '{spacing.sm}', rounded: '{rounded.md}' },
      tabActive: { textColor: '{colors.primary}' },
      indicator: { backgroundColor: '{colors.primary}', height: '2px' },
      pillActive: { backgroundColor: '{colors.primary}', textColor: '{colors.on-primary}' },
      containedActive: {
        backgroundColor: '{colors.surface-default}',
        textColor: '{colors.on-surface}',
        shadow: '{shadows.sm}',
      },
      panel: {
        padding: '{spacing.md}',
        textColor: '{colors.on-surface}',
        typography: '{typography.body-md}',
      },
    },
    responsive: {
      md: {
        layout: 'Vertical orientation is honored; below md tabs are one horizontal row that scrolls.',
      },
    },
    examples: [
      { label: 'Line', props: { variant: 'line' } },
      { label: 'Pill', props: { variant: 'pill' } },
    ],
    dosDonts: {
      dos: ['Use role="tablist" / "tab" / "tabpanel" with aria-selected and aria-controls', 'Move between tabs with the arrow keys'],
      donts: ["Don't use tabs for sequential steps — use a stepper"],
    },
  },

  Breadcrumbs: {
    name: 'Breadcrumbs',
    description: 'Hierarchical trail to the current page, with a tokenized separator.',
    category: 'navigation',
    variants: ['default'],
    sizes: [],
    states: ['default', 'hover'],
    anatomy: ['root', 'item', 'separator', 'current'],
    props: {
      separator: { type: 'enum', values: ['chevron', 'slash', 'dot'], default: 'chevron' },
    },
    tokens: {
      base: {
        textColor: '{colors.on-surface-muted}',
        typography: '{typography.body-sm}',
      },
      link: { textColor: '{colors.primary}' },
      current: { textColor: '{colors.on-surface}' },
      separator: { textColor: '{colors.on-surface-subtle}' },
    },
    responsive: {
      md: {
        layout: 'Full trail; below md the middle crumbs collapse to an ellipsis.',
      },
    },
    examples: [{ label: 'Chevron', props: { separator: 'chevron' } }],
    dosDonts: {
      dos: ['Wrap in <nav aria-label="Breadcrumb"> and mark the last item aria-current="page"'],
      donts: ["Don't link the current page"],
    },
  },

  Pagination: {
    name: 'Pagination',
    description: 'Numbered page links with previous / next controls.',
    category: 'navigation',
    variants: ['default'],
    sizes: ['sm', 'md'],
    states: ['default', 'hover', 'current', 'disabled'],
    anatomy: ['root', 'prev', 'item', 'ellipsis', 'next'],
    props: {
      page: { type: 'number', default: 3, description: 'Current page (1-based)' },
      pageCount: { type: 'number', default: 10 },
      showPrevNext: { type: 'boolean', default: true },
    },
    tokens: {
      base: {
        textColor: '{colors.on-surface}',
        typography: '{typography.label-md}',
      },
      item: {
        paddingX: '{spacing.sm}',
        paddingY: '{spacing.xs}',
        rounded: '{rounded.md}',
        borderColor: '{colors.surface-border}',
        borderWidth: '1px',
      },
      itemActive: {
        backgroundColor: '{colors.primary}',
        textColor: '{colors.on-primary}',
        borderColor: '{colors.primary}',
      },
    },
    responsive: {
      md: {
        layout: 'Numbered pages; below md only previous / next with "Page x of y".',
      },
    },
    examples: [{ label: 'Page 3 of 10', props: { page: 3, pageCount: 10 } }],
    dosDonts: {
      dos: ['Wrap in <nav aria-label="Pagination">; mark the current page aria-current="page"', 'Give prev/next an aria-label'],
      donts: ["Don't render more than 7 page slots — use an ellipsis"],
    },
  },

  Accordion: {
    name: 'Accordion',
    description: 'Stacked disclosure sections. Single or multiple open; height animates unless reduced motion is set.',
    category: 'layout',
    variants: ['default'],
    sizes: [],
    states: ['collapsed', 'expanded', 'disabled'],
    anatomy: ['root', 'item', 'trigger', 'icon', 'content'],
    props: {
      type: { type: 'enum', values: ['single', 'multiple'], default: 'single', description: 'How many sections may be open at once' },
      children: { type: 'slot', description: 'Accordion items' },
    },
    tokens: {
      base: {
        backgroundColor: '{colors.surface-default}',
        borderColor: '{colors.surface-border}',
        borderWidth: '1px',
        rounded: '{rounded.md}',
      },
      trigger: {
        paddingX: '{spacing.md}',
        paddingY: '{spacing.sm}',
        textColor: '{colors.on-surface}',
        typography: '{typography.label-lg}',
      },
      content: {
        paddingX: '{spacing.md}',
        paddingY: '{spacing.sm}',
        textColor: '{colors.on-surface-muted}',
        typography: '{typography.body-md}',
      },
      divider: { borderColor: '{colors.surface-border}', borderWidth: '1px' },
    },
    examples: [{ label: 'Single', props: { type: 'single' } }],
    dosDonts: {
      dos: ['Make each trigger a <button> with aria-expanded and aria-controls', 'Respect prefers-reduced-motion'],
      donts: ["Don't hide content a user must read to finish a task"],
    },
  },

  Progress: {
    name: 'Progress',
    description: 'Progress bar. Determinate shows a value; indeterminate shows ongoing work with no known end.',
    category: 'feedback',
    variants: ['determinate', 'indeterminate'],
    sizes: ['sm', 'md'],
    states: ['default', 'complete'],
    anatomy: ['root', 'track', 'fill', 'label'],
    props: {
      value: { type: 'number', default: 40 },
      max: { type: 'number', default: 100 },
      label: { type: 'string', description: 'Accessible name' },
    },
    tokens: {
      base: {
        backgroundColor: '{colors.surface-overlay}',
        rounded: '{rounded.full}',
        height: '8px',
      },
      determinate: {},
      indeterminate: {},
      fill: { backgroundColor: '{colors.primary}', rounded: '{rounded.full}' },
      label: { textColor: '{colors.on-surface-muted}', typography: '{typography.label-sm}' },
    },
    examples: [
      { label: 'Determinate', props: { variant: 'determinate', value: 40, label: 'Uploading' } },
      { label: 'Indeterminate', props: { variant: 'indeterminate', label: 'Loading' } },
    ],
    dosDonts: {
      dos: ['Use role="progressbar" with aria-valuenow/min/max; omit aria-valuenow when indeterminate'],
      donts: ["Don't animate the indeterminate bar when reduced motion is requested"],
    },
  },

  EmptyState: {
    name: 'EmptyState',
    description: 'Placeholder for a view with no content yet: icon, title, description, and a next action.',
    category: 'feedback',
    variants: ['default'],
    sizes: [],
    states: ['default'],
    anatomy: ['root', 'icon', 'title', 'description', 'action'],
    props: {
      title: { type: 'string', default: 'No projects yet' },
      description: { type: 'string', default: 'Create your first project to get started.' },
      actionLabel: { type: 'string', default: 'New project' },
    },
    tokens: {
      base: {
        backgroundColor: '{colors.surface-default}',
        textColor: '{colors.on-surface}',
        borderColor: '{colors.surface-border}',
        borderWidth: '1px',
        rounded: '{rounded.lg}',
        padding: '{spacing.lg}',
      },
      icon: { textColor: '{colors.on-surface-subtle}', size: '40px' },
      title: { textColor: '{colors.on-surface}', typography: '{typography.headline-sm}' },
      description: { textColor: '{colors.on-surface-muted}', typography: '{typography.body-md}' },
      action: {
        backgroundColor: '{colors.primary}',
        textColor: '{colors.on-primary}',
        rounded: '{rounded.md}',
        paddingX: '{spacing.md}',
        paddingY: '{spacing.sm}',
      },
    },
    responsive: {
      md: { tokens: { padding: '{spacing.2xl}' } },
    },
    examples: [{ label: 'No projects', props: { title: 'No projects yet', actionLabel: 'New project' } }],
    dosDonts: {
      dos: ['Explain why the view is empty and offer one clear next step'],
      donts: ["Don't show an empty state while data is still loading — use a skeleton"],
    },
  },

  ErrorState: {
    name: 'ErrorState',
    description: 'Full-view error: not found (404), server error (500), or no permission (403), with a recovery action.',
    category: 'feedback',
    variants: ['not-found', 'server-error', 'forbidden'],
    sizes: [],
    states: ['default'],
    anatomy: ['root', 'code', 'icon', 'title', 'description', 'action'],
    props: {
      variant: { type: 'enum', values: ['not-found', 'server-error', 'forbidden'], default: 'not-found' },
      actionLabel: { type: 'string', default: 'Go home' },
    },
    tokens: {
      base: {
        textColor: '{colors.on-surface}',
        rounded: '{rounded.lg}',
        padding: '{spacing.lg}',
      },
      'not-found': { backgroundColor: '{colors.surface-raised}' },
      'server-error': { backgroundColor: '{colors.status-error-surface}' },
      forbidden: { backgroundColor: '{colors.status-warning-surface}' },
      code: { textColor: '{colors.on-surface-subtle}', typography: '{typography.display-md}' },
      icon: { textColor: '{colors.on-surface-muted}', size: '32px' },
      title: { textColor: '{colors.on-surface}', typography: '{typography.headline-sm}' },
      description: { textColor: '{colors.on-surface-muted}', typography: '{typography.body-md}' },
      action: {
        backgroundColor: '{colors.primary}',
        textColor: '{colors.on-primary}',
        rounded: '{rounded.md}',
        paddingX: '{spacing.md}',
        paddingY: '{spacing.sm}',
      },
    },
    responsive: {
      md: { tokens: { padding: '{spacing.2xl}' } },
    },
    examples: [
      { label: '404', props: { variant: 'not-found' } },
      { label: '500', props: { variant: 'server-error', actionLabel: 'Try again' } },
    ],
    dosDonts: {
      dos: ['Say what happened in plain words and offer a way out'],
      donts: ["Don't show stack traces or internal error ids to end users"],
    },
  },

  Table: {
    name: 'Table',
    description: 'Tabular data with sortable headers, row selection, and a pagination slot. Rows stack into cards on small screens.',
    category: 'data',
    variants: ['default'],
    sizes: [],
    states: ['default', 'row-hover', 'row-selected', 'sorted'],
    anatomy: ['root', 'header', 'header-cell', 'sort-icon', 'row', 'cell', 'select', 'pagination'],
    props: {
      sortable: { type: 'boolean', default: true },
      selectable: { type: 'boolean', default: true },
      pagination: { type: 'slot', description: 'Pagination under the table' },
    },
    tokens: {
      base: {
        backgroundColor: '{colors.surface-default}',
        textColor: '{colors.on-surface}',
        borderColor: '{colors.surface-border}',
        borderWidth: '1px',
        rounded: '{rounded.lg}',
        typography: '{typography.body-sm}',
      },
      header: {
        backgroundColor: '{colors.surface-raised}',
        textColor: '{colors.on-surface-muted}',
        typography: '{typography.label-sm}',
      },
      row: { borderColor: '{colors.surface-border-subtle}', borderWidth: '1px' },
      rowSelected: { backgroundColor: '{colors.status-info-surface}' },
      cell: { paddingX: '{spacing.md}', paddingY: '{spacing.sm}' },
    },
    responsive: {
      md: {
        layout: 'Full table; below md each row stacks into a label / value card.',
      },
    },
    examples: [{ label: 'Sortable + selectable', props: { sortable: true, selectable: true } }],
    dosDonts: {
      dos: ['Put aria-sort on the sorted header; make sort controls buttons', 'Label each row checkbox with the row name'],
      donts: ["Don't use a table for layout"],
    },
  },

  Drawer: {
    name: 'Drawer',
    description: 'Panel that slides in from the left, right, or bottom over an overlay. Becomes a bottom sheet on small screens.',
    category: 'layout',
    variants: ['default'],
    sizes: ['sm', 'md', 'lg'],
    states: ['open', 'closed'],
    anatomy: ['overlay', 'root', 'header', 'title', 'close', 'body', 'footer'],
    props: {
      side: { type: 'enum', values: ['left', 'right', 'bottom'], default: 'right' },
      open: { type: 'boolean', default: false },
      title: { type: 'string', default: 'Filters' },
      children: { type: 'slot', description: 'Drawer body' },
    },
    tokens: {
      base: {
        backgroundColor: '{colors.surface-default}',
        textColor: '{colors.on-surface}',
        shadow: '{shadows.xl}',
        padding: '{spacing.lg}',
        width: '320px',
      },
      overlay: { backgroundColor: '{colors.on-surface}', opacity: '{opacity.muted}' },
      header: {
        typography: '{typography.headline-sm}',
        borderColor: '{colors.surface-border}',
        borderWidth: '1px',
      },
      sheet: { rounded: '{rounded.xl}' },
    },
    responsive: {
      md: {
        layout: 'Side panel from the chosen edge; below md it renders as a bottom sheet.',
      },
    },
    examples: [{ label: 'Right', props: { side: 'right', title: 'Filters' } }],
    dosDonts: {
      dos: ['Use role="dialog" with an accessible name; move focus in on open and restore it on close', 'Close on Escape and overlay click'],
      donts: ["Don't stack drawers"],
    },
  },
}
