import { test, expect } from '@playwright/test'

test.describe('UI Performance', () => {
  test('login page loads under 3s', async ({ page }) => {
    const t = Date.now()
    await page.goto('/login')
    const elapsed = Date.now() - t
    console.log(`  Login page load: ${elapsed}ms`)
    expect(elapsed).toBeLessThan(3000)
  })

  test('dashboard renders under 3s after login', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[placeholder="Username"]', 'admin')
    await page.fill('input[placeholder="Password"]', 'admin123')
    await page.click('button[type="submit"]')
    const t = Date.now()
    await page.waitForURL('/')
    await page.waitForSelector('text=Total Sites')
    const elapsed = Date.now() - t
    console.log(`  Dashboard render: ${elapsed}ms`)
    expect(elapsed).toBeLessThan(3000)
  })

  test('topology page renders under 5s', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[placeholder="Username"]', 'admin')
    await page.fill('input[placeholder="Password"]', 'admin123')
    await page.click('button[type="submit"]')
    await page.waitForURL('/')

    const t = Date.now()
    await page.goto('/topology')
    await page.waitForSelector('button:has-text("Router")')
    const elapsed = Date.now() - t
    console.log(`  Topology render: ${elapsed}ms`)
    expect(elapsed).toBeLessThan(5000)
  })

  test('alarms page renders under 5s', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[placeholder="Username"]', 'admin')
    await page.fill('input[placeholder="Password"]', 'admin123')
    await page.click('button[type="submit"]')
    await page.waitForURL('/')

    const t = Date.now()
    await page.goto('/alarms')
    await page.waitForURL('/alarms')
    await page.waitForSelector('text=xlsx', { timeout: 5000 })
    const elapsed = Date.now() - t
    console.log(`  Alarms render: ${elapsed}ms`)
    expect(elapsed).toBeLessThan(5000)
  })
})
