import { test, expect, type Page } from '@playwright/test'

// Tier 2 components render in the showcase from the current tokens, repaint on
// a token edit, and switch layout at their responsive override — at mobile,
// tablet and desktop widths.

// Reduced motion: layout is asserted at rest (the drawer slides in otherwise),
// and it exercises the prefers-reduced-motion path of every preview.
test.use({ contextOptions: { reducedMotion: 'reduce' } })

const TIER2 = ['Navbar', 'Sidebar', 'Tabs', 'Breadcrumbs', 'Pagination', 'Accordion', 'Progress', 'EmptyState', 'ErrorState', 'Table', 'Drawer']
const VIEWPORTS = [
  ['mobile', 'mobile (375)'],
  ['tablet', 'tablet (768)'],
  ['desktop', 'desktop (1280)'],
] as const

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`
}

async function viewport(page: Page, title: string) {
  await page.getByTitle(title).click()
}

async function setColor(page: Page, token: string, hex: string) {
  const input = page.getByTestId(`token-editor-color-${token}`)
  await input.fill(hex)
  await input.press('Enter')
}

test('every Tier 2 component renders inside the preview frame at each viewport', async ({ page }) => {
  await page.goto('/workspace')
  const frame = page.getByTestId('preview-frame')
  for (const [, title] of VIEWPORTS) {
    await viewport(page, title)
    const frameBox = (await frame.boundingBox())!
    for (const name of TIER2) {
      const el = page.getByTestId(`preview-${name}`)
      await expect(el, `${name} @ ${title}`).toBeVisible()
      const box = (await el.boundingBox())!
      // Guards the named-size trap (w-sm = 8px) and horizontal overflow.
      expect(box.width, `${name} width @ ${title}`).toBeGreaterThan(40)
      expect(box.x + box.width, `${name} overflows @ ${title}`).toBeLessThanOrEqual(frameBox.x + frameBox.width + 1)
    }
  }
})

test('a token edit repaints every Tier 2 component live', async ({ page }) => {
  await page.goto('/workspace')
  await viewport(page, 'desktop (1280)')

  const PRIMARY = '#FF5500'
  const SURFACE = '#FFF7E0'
  const BORDER = '#00AA88'
  const RAISED = '#E0F0FF'
  const OVERLAY = '#CCCCFF'
  const ERROR_SURFACE = '#FFE0E6'

  await setColor(page, 'primary', PRIMARY)
  await setColor(page, 'surface-default', SURFACE)
  await setColor(page, 'surface-border', BORDER)
  await setColor(page, 'surface-raised', RAISED)
  await setColor(page, 'surface-overlay', OVERLAY)
  await setColor(page, 'status-error-surface', ERROR_SURFACE)

  const bg = 'background-color'
  const checks: Array<[string, ReturnType<Page['locator']>, string, string]> = [
    ['Navbar', page.getByTestId('preview-Navbar'), bg, SURFACE],
    ['Sidebar', page.getByTestId('preview-Sidebar'), bg, SURFACE],
    ['Tabs', page.getByTestId('preview-Tabs-pill').getByRole('tab', { selected: true }), bg, PRIMARY],
    ['Breadcrumbs', page.getByTestId('preview-Breadcrumbs').getByRole('link').first(), 'color', PRIMARY],
    ['Pagination', page.getByTestId('preview-Pagination').locator('[aria-current="page"]'), bg, PRIMARY],
    ['Accordion', page.getByTestId('preview-Accordion'), 'border-top-color', BORDER],
    ['Progress', page.getByTestId('preview-Progress'), bg, OVERLAY],
    ['EmptyState', page.getByTestId('preview-EmptyState').getByRole('button'), bg, PRIMARY],
    ['ErrorState', page.getByTestId('preview-ErrorState-server-error'), bg, ERROR_SURFACE],
    ['Table', page.getByTestId('preview-Table').locator('thead'), bg, RAISED],
    ['Drawer', page.getByTestId('preview-Drawer'), bg, SURFACE],
  ]
  for (const [name, loc, prop, hex] of checks) {
    await expect(loc, name).toHaveCSS(prop, rgb(hex))
  }
})

test('responsive overrides switch Navbar, Table and Drawer layouts across viewports', async ({ page }) => {
  await page.goto('/workspace')
  const navbar = page.getByTestId('preview-Navbar')
  const toggle = navbar.getByRole('button', { name: 'Open menu' })

  // Mobile: links collapse behind the toggle; the table stacks; the drawer is a sheet.
  await viewport(page, 'mobile (375)')
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await toggle.click()
  await expect(navbar.getByRole('button', { name: 'Close menu' })).toHaveAttribute('aria-expanded', 'true')
  await expect(navbar.getByRole('link', { name: 'Home' })).toBeVisible()
  await expect(page.getByTestId('preview-Table').getByRole('table')).toHaveCount(0)
  const overlay = page.getByTestId('drawer-overlay')
  // Panel width minus overlay width, measured together (the inspector opening reflows).
  const spare = async () => {
    const [panel, over] = await Promise.all([page.getByTestId('preview-Drawer').boundingBox(), overlay.boundingBox()])
    return Math.round(over!.width - panel!.width)
  }
  await expect.poll(spare).toBeLessThanOrEqual(2) // full-width bottom sheet

  // Tablet (md): links inline, a real table, a side panel.
  await viewport(page, 'tablet (768)')
  await expect(navbar.getByRole('button', { name: /menu/ })).toHaveCount(0)
  await expect(navbar.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Pricing' })).toBeVisible()
  await expect(page.getByTestId('preview-Table').getByRole('table')).toBeVisible()
  await expect.poll(spare).toBeGreaterThan(20) // side panel, page visible beside it

  // Move Navbar's layout breakpoint from md to lg in the editor → tablet collapses again.
  // Navbar is already selected: the menu-toggle click above selected its section.
  await page.getByRole('button', { name: 'Responsive', exact: true }).click()
  await page.getByTestId('responsive-bp-select').selectOption('md')
  await page.getByTestId('responsive-layout-note').fill('')
  await page.getByTestId('responsive-layout-note').press('Enter')
  await page.getByTestId('responsive-layout-note').blur()
  await page.getByTestId('responsive-bp-select').selectOption('lg')
  await page.getByTestId('responsive-layout-note').fill('Links inline from lg')
  await page.getByTestId('responsive-layout-note').blur()
  await expect(navbar.getByRole('button', { name: /menu/ })).toBeVisible() // collapsed again at 768
  await viewport(page, 'desktop (1280)')
  await expect(navbar.getByRole('button', { name: /menu/ })).toHaveCount(0)

  // SKILL.md carries the moved layout note.
  await page.getByRole('button', { name: 'SKILL.md' }).click()
  await expect(page.locator('.fp__content')).toContainText('Links inline from lg')
})

test('a workspace saved before Tier 2 gains it on load and keeps its edits', async ({ page }) => {
  // Seed the legacy single-schema key with a pre-Tier-2 save: no Tabs … Drawer,
  // and a customized primary color.
  await page.goto('/workspace')
  const stored = await page.evaluate(() => {
    const listKey = Object.keys(localStorage).find((k) => k.startsWith('dsa-ws-'))!
    return JSON.parse(localStorage.getItem(listKey)!) as { colors: Record<string, string>; componentBlueprints: Record<string, unknown> }
  })
  for (const n of ['Tabs', 'Breadcrumbs', 'Pagination', 'Accordion', 'Progress', 'EmptyState', 'ErrorState', 'Table', 'Drawer']) {
    delete stored.componentBlueprints[n]
  }
  stored.colors.primary = '#AB00CD'
  await page.evaluate((schema) => {
    localStorage.clear()
    localStorage.setItem('dsa-schema-v1', JSON.stringify(schema))
  }, stored)

  await page.reload()
  await expect(page.getByTestId('preview-Table')).toBeVisible()
  await expect(page.getByTestId('preview-Drawer')).toBeVisible()
  await expect(page.getByTestId('token-editor-color-primary')).toHaveValue(/#ab00cd/i)
  await expect(page.getByTestId('preview-Pagination').locator('[aria-current="page"]')).toHaveCSS('background-color', rgb('#AB00CD'))
})
