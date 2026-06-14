import { test, expect } from '@playwright/test'

// Phase 4 acceptance: add a tablet padding override on Button → the preview at
// 768px reflects it → SKILL.md shows the responsive snippet.
test('Button tablet padding override flows to preview and SKILL.md', async ({ page }) => {
  await page.goto('/workspace')

  // Button base padding-x is spacing.md (16px) at every viewport initially.
  const button = page.getByTestId('preview-Button')
  await expect(button).toHaveCSS('padding-left', '16px')

  // Open the Components tab → Responsive sub-tab (Button is selected by default).
  await page.getByRole('button', { name: 'Components', exact: true }).click()
  await page.getByRole('button', { name: 'Responsive', exact: true }).click()

  // Add a tablet (md / 768px) override for paddingX, then point it at spacing.lg.
  await page.getByTestId('responsive-bp-select').selectOption('md')
  const override = page.locator('.be__override')
  const paddingXRow = override.locator('.tg__prop', { hasText: 'paddingX' }).first()
  await paddingXRow.getByRole('button', { name: 'override' }).click()
  await override.locator('.tg__prop', { hasText: 'paddingX' }).first().getByLabel('Token reference').selectOption('{spacing.lg}')

  // Switch the preview to the tablet (768px) viewport — padding grows to spacing.lg (24px).
  await page.getByTitle('tablet (768)').click()
  await expect(button).toHaveCSS('padding-left', '24px')

  // Mobile still uses the base value.
  await page.getByTitle('mobile (375)').click()
  await expect(button).toHaveCSS('padding-left', '16px')

  // SKILL.md carries the responsive snippet.
  await page.getByRole('button', { name: 'SKILL.md' }).click()
  await expect(page.locator('.fp__content')).toContainText('{spacing.lg}')
  await expect(page.locator('.fp__content')).toContainText('(md)')

  // Nested component files (components/<stack>/…) are selectable in the tree.
  await page.getByRole('button', { name: 'Button.tsx', exact: true }).click()
  await expect(page.locator('.right-panel__filename')).toHaveText('components/react-tailwind/Button.tsx')
})
