import { test, expect } from '@playwright/test'

test.describe('Agents Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/agents')
  })

  test('should display agents page title', async ({ page }) => {
    await expect(page.getByText('Agents')).toBeVisible()
    await expect(page.getByText('Manage and monitor your registered agents')).toBeVisible()
  })

  test('should display register agent button', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Register Agent' })).toBeVisible()
  })

  test('should have search functionality', async ({ page }) => {
    await expect(page.getByPlaceholder('Search agents...')).toBeVisible()
  })

  test('should have status filter', async ({ page }) => {
    await expect(page.getByText('All Status')).toBeVisible()
  })

  test('should have sort dropdown', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Sort' })).toBeVisible()
  })

  test('should have view mode toggle', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Grid' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'List' })).toBeVisible()
  })

  test('should switch to list view', async ({ page }) => {
    await page.getByRole('button', { name: 'List' }).click()
    await expect(page.getByRole('table')).toBeVisible()
  })

  test('should navigate to agent detail page', async ({ page }) => {
    // Click on first agent card
    const agentCard = page.locator('[class*="AgentCard"]').first()
    if (await agentCard.isVisible().catch(() => false)) {
      await agentCard.click()
      await expect(page).toHaveURL(/.*agents\/.+/)
    }
  })
})
