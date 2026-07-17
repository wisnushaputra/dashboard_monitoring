import { test, expect } from '@playwright/test'

test.describe('Alarms Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[placeholder="Username"]', 'admin')
    await page.fill('input[placeholder="Password"]', 'admin123')
    await page.click('button[type="submit"]')
    await page.waitForURL('/')
  })

  test('navigate to alarms page', async ({ page }) => {
    await page.getByRole('link', { name: 'Alarms' }).click()
    await expect(page).toHaveURL('/alarms')
  })

  test('alarms page has export buttons', async ({ page }) => {
    await page.goto('/alarms')
    await expect(page.getByRole('link', { name: /xlsx/i }).first()).toBeVisible()
  })

  test('alarms page has search filter', async ({ page }) => {
    await page.goto('/alarms')
    await expect(page.getByPlaceholder(/search/i).first()).toBeVisible()
  })

  test('history page renders heading', async ({ page }) => {
    await page.goto('/history')
    await expect(page.getByRole('heading', { name: 'History Monitoring' })).toBeVisible()
  })
})
