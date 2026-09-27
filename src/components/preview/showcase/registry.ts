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
}

export function previewFor(name: string): Component {
  return PREVIEWS[name] ?? GenericPreview
}
