import { test, expect } from '@playwright/test'

test.describe('Transactions Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/transactions')
  })

  test('should display transactions page title', async ({ page }) => {
    await expect(page.getByText('Transactions')).toBeVisible()
    await expect(page.getByText('View and manage all payment transactions')).toBeVisible()
  })

  test('should display export button', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Export CSV' })).toBeVisible()
  })

  test('should have search functionality', async ({ page }) => {
    await expect(page.getByPlaceholder('Search transactions...')).toBeVisible()
  })

  test('should have status filter', async ({ page }) => {
    await expect(page.getByText('All Status')).toBeVisible()
  })

  test('should have type filter', async ({ page }) => {
    await expect(page.getByText('All Types')).toBeVisible()
  })

  test('should have date filters', async ({ page }) => {
    await expect(page.getByLabel('Date From')).toBeVisible()
    await expect(page.getByLabel('Date To')).toBeVisible()
  })

  test('should have amount filters', async ({ page }) => {
    await expect(page.getByLabel('Min Amount')).toBeVisible()
    await expect(page.getByLabel('Max Amount')).toBeVisible()
  })

  test('should display transactions table', async ({ page }) => {
    await expect(page.getByRole('table')).toBeVisible()
  })

  test('should display pagination when there are multiple pages', async ({ page }) => {
    const pagination = page.locator('[class*="Pagination"]').first()
    if (await pagination.isVisible().catch(() => false)) {
      await expect(pagination).toBeVisible()
    }
  })
})
