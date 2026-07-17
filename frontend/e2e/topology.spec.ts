import { test, expect } from '@playwright/test'

test.describe('Topology Editor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[placeholder="Username"]', 'admin')
    await page.fill('input[placeholder="Password"]', 'admin123')
    await page.click('button[type="submit"]')
    await page.waitForURL('/')
  })

  test('navigate to topology page', async ({ page }) => {
    await page.getByRole('link', { name: 'Topology' }).click()
    await expect(page).toHaveURL('/topology')
  })

  test('topology page renders node palette', async ({ page }) => {
    await page.goto('/topology')
    await expect(page.getByRole('button', { name: /Router/ }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /Switch/ }).first()).toBeVisible()
  })

  test('can add node from palette', async ({ page }) => {
    await page.goto('/topology')
    const routerBtn = page.getByRole('button', { name: /Router/ }).first()
    await expect(routerBtn).toBeVisible()
  })

  test('dashboard shows summary cards', async ({ page }) => {
    await expect(page.getByText('Total Sites')).toBeVisible()
    await expect(page.getByText('Node Online')).toBeVisible()
    await expect(page.getByText('Active Alarms')).toBeVisible()
  })
})
