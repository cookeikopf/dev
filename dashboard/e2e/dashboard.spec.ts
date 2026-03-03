import { test, expect } from '@playwright/test'

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard (will redirect to sign-in if not authenticated)
    await page.goto('/dashboard')
  })

  test('should display dashboard title', async ({ page }) => {
    // This test assumes user is authenticated or mocks authentication
    await expect(page.getByText('Dashboard')).toBeVisible()
  })

  test('should display stats cards', async ({ page }) => {
    await expect(page.getByText('Total Agents')).toBeVisible()
    await expect(page.getByText('Active Agents')).toBeVisible()
    await expect(page.getByText('Total Volume')).toBeVisible()
    await expect(page.getByText('Transactions')).toBeVisible()
  })

  test('should display charts', async ({ page }) => {
    await expect(page.getByText('Revenue Overview')).toBeVisible()
    await expect(page.getByText('Transaction Volume')).toBeVisible()
  })

  test('should display activity feed', async ({ page }) => {
    await expect(page.getByText('Recent Activity')).toBeVisible()
  })

  test('should display top agents', async ({ page }) => {
    await expect(page.getByText('Top Performing Agents')).toBeVisible()
  })

  test('should navigate to agents page', async ({ page }) => {
    await page.getByRole('link', { name: 'Agents' }).click()
    await expect(page).toHaveURL(/.*agents/)
    await expect(page.getByText('Agents')).toBeVisible()
  })

  test('should navigate to transactions page', async ({ page }) => {
    await page.getByRole('link', { name: 'Transactions' }).click()
    await expect(page).toHaveURL(/.*transactions/)
    await expect(page.getByText('Transactions')).toBeVisible()
  })
})
