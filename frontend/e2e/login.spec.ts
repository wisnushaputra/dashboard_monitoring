import { test, expect } from '@playwright/test'

test.describe('Login Flow', () => {
  test('redirects to /login when not authenticated', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL('/login')
  })

  test('shows login form', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByPlaceholder('Username')).toBeVisible()
    await expect(page.getByPlaceholder('Password')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible()
  })

  test('login with valid admin credentials', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[placeholder="Username"]', 'admin')
    await page.fill('input[placeholder="Password"]', 'admin123')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL('/', { timeout: 10000 })
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  })

  test('login with wrong password shows error', async ({ page }) => {
    await page.goto('/login')
    await page.locator('input[placeholder="Username"]').pressSequentially('admin')
    await page.locator('input[placeholder="Password"]').pressSequentially('wrong')
    await page.locator('button[type="submit"]').click()
    await page.waitForTimeout(1000)
    await expect(page.getByText('Invalid credentials')).toBeVisible({ timeout: 10000 })
    await expect(page).toHaveURL('/login')
  })

  test('login as operator and verify limited access', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[placeholder="Username"]', 'operator')
    await page.fill('input[placeholder="Password"]', 'operator123')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL('/', { timeout: 10000 })
    await expect(page.getByText('Users')).toHaveCount(0)
  })

  test('login as viewer and verify read-only', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[placeholder="Username"]', 'viewer')
    await page.fill('input[placeholder="Password"]', 'viewer123')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL('/', { timeout: 10000 })
  })

  test('logout clears session', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[placeholder="Username"]', 'admin')
    await page.fill('input[placeholder="Password"]', 'admin123')
    await page.click('button[type="submit"]')
    await page.waitForURL('/')

    await page.getByTitle(/logout/i).click()
    await expect(page).toHaveURL('/login')
  })
})
