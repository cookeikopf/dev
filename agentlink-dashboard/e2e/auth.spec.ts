import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('should redirect to sign-in when not authenticated', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/.*sign-in/)
  })

  test('should display sign-in page', async ({ page }) => {
    await page.goto('/sign-in')
    await expect(page.getByText('Welcome to AgentLink')).toBeVisible()
    await expect(page.getByText('Sign in to manage your AI agents')).toBeVisible()
  })

  test('should display sign-up page', async ({ page }) => {
    await page.goto('/sign-up')
    await expect(page.getByText('Create an Account')).toBeVisible()
    await expect(page.getByText('Join AgentLink to start managing AI agents')).toBeVisible()
  })
})
