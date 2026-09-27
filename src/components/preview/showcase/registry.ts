import type { Component } from 'vue'
import ButtonPreview from './ButtonPreview.vue'
import InputPreview from './InputPreview.vue'
import TextPreview from './TextPreview.vue'
import CardPreview from './CardPreview.vue'
import AlertPreview from './AlertPreview.vue'
import CheckboxPreview from './CheckboxPreview.vue'
import DropdownPreview from './DropdownPreview.vue'
import RadioPreview from './RadioPreview.vue'
import NavbarPreview from './NavbarPreview.vue'
import SidebarPreview from './SidebarPreview.vue'
import TabsPreview from './TabsPreview.vue'
import BreadcrumbsPreview from './BreadcrumbsPreview.vue'
import PaginationPreview from './PaginationPreview.vue'
import AccordionPreview from './AccordionPreview.vue'
import DrawerPreview from './DrawerPreview.vue'
import ProgressPreview from './ProgressPreview.vue'
import EmptyStatePreview from './EmptyStatePreview.vue'
import ErrorStatePreview from './ErrorStatePreview.vue'
import TablePreview from './TablePreview.vue'
import GenericPreview from './GenericPreview.vue'

// Blueprint name → its showcase renderer. Each renderer takes `PreviewProps`
// and styles itself from `var(--…)` tokens only. A blueprint without an entry
// (e.g. one added by hand) renders through GenericPreview.
const PREVIEWS: Record<string, Component> = {
  Button: ButtonPreview,
  Input: InputPreview,
  Badge: TextPreview,
  Tooltip: TextPreview,
  Card: CardPreview,
  Alert: AlertPreview,
  Checkbox: CheckboxPreview,
  Dropdown: DropdownPreview,
  Radio: RadioPreview,
  Navbar: NavbarPreview,
  Sidebar: SidebarPreview,
  Tabs: TabsPreview,
  Breadcrumbs: BreadcrumbsPreview,
  Pagination: PaginationPreview,
  Accordion: AccordionPreview,
  Drawer: DrawerPreview,
  Progress: ProgressPreview,
  EmptyState: EmptyStatePreview,
  ErrorState: ErrorStatePreview,
  Table: TablePreview,
}

export function previewFor(name: string): Component {
  return PREVIEWS[name] ?? GenericPreview
}
