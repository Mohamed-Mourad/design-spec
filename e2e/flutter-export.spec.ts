import { test, expect } from '@playwright/test'

// Flutter acceptance: selecting the Flutter stack emits Dart theme files and
// widget stubs in the preview, and switching the naming convention changes the
// identifiers they reference.
test('Flutter stack emits Dart theme + widgets in the chosen naming', async ({ page }) => {
  await page.goto('/workspace')

  // Turn Flutter on from the stack menu; the naming choice appears with it.
  await page.getByText(/^Stacks · /).click()
  await page.getByRole('button', { name: 'Flutter', exact: true }).click()
  const naming = page.getByLabel('Flutter naming convention')
  await expect(naming).toHaveValue('prefixed-class')

  // The theme files are in the tree, highlighted as Dart.
  await page.getByRole('button', { name: 'app_theme.dart', exact: true }).click()
  await expect(page.locator('.right-panel__filename')).toHaveText('lib/theme/app_theme.dart')
  await expect(page.locator('.fp__content')).toContainText('ThemeData(')
  await expect(page.locator('.fp__content')).toContainText('seedColor: AppColors.primary')

  // A widget stub: responsive via LayoutBuilder against the breakpoint tokens.
  await page.getByRole('button', { name: 'button.dart', exact: true }).click()
  await expect(page.locator('.right-panel__filename')).toHaveText('lib/widgets/Button/button.dart')
  await expect(page.locator('.fp__content')).toContainText('return LayoutBuilder(')
  await expect(page.locator('.fp__content')).toContainText('backgroundColor: AppColors.primary')

  // Switch to the raw k-const convention (the menu closed on the tree click) —
  // the same stub now references kColor….
  await page.getByText(/^Stacks · /).click()
  await naming.selectOption('raw')
  await expect(page.locator('.fp__content')).toContainText('backgroundColor: kColorPrimary')
  await expect(page.locator('.fp__content')).not.toContainText('AppColors.')

  // SKILL.md documents the Flutter stack in the chosen convention.
  await page.getByRole('button', { name: 'SKILL.md' }).click()
  await expect(page.locator('.fp__content')).toContainText('### Flutter')
  await expect(page.locator('.fp__content')).toContainText('color `kColorPrimary`')
})
