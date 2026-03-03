/**
 * AgentLink Dashboard - E2E Smoke Tests
 */

import { test, expect } from '@playwright/test';

test.describe('Dashboard Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard
    await page.goto('http://localhost:3000');
  });

  test('should display dashboard homepage', async ({ page }) => {
    // Check page title
    await expect(page).toHaveTitle(/AgentLink/);

    // Check main navigation
    await expect(page.getByRole('navigation')).toBeVisible();
    await expect(page.getByText('Dashboard')).toBeVisible();
  });

  test('should display agent list', async ({ page }) => {
    // Check agents section exists
    await expect(page.getByText('Your Agents')).toBeVisible();

    // Check agent cards or empty state
    const agentCards = page.locator('[data-testid="agent-card"]');
    const emptyState = page.getByText('No agents yet');

    await expect(agentCards.or(emptyState).first()).toBeVisible();
  });

  test('should navigate to agent details', async ({ page }) => {
    // Click on first agent if exists
    const firstAgent = page.locator('[data-testid="agent-card"]').first();
    
    if (await firstAgent.isVisible().catch(() => false)) {
      await firstAgent.click();
      
      // Should navigate to agent details
      await expect(page).toHaveURL(/\/agents\//);
      await expect(page.getByText('Agent Details')).toBeVisible();
    }
  });

  test('should display payment stats', async ({ page }) => {
    // Check payment stats section
    await expect(page.getByText('Payment Stats')).toBeVisible();
    
    // Check stat cards
    await expect(page.getByText('Total Revenue')).toBeVisible();
    await expect(page.getByText('Total Requests')).toBeVisible();
  });

  test('should display recent activity', async ({ page }) => {
    // Check activity section
    await expect(page.getByText('Recent Activity')).toBeVisible();
    
    // Activity list should be visible
    await expect(page.locator('[data-testid="activity-list"]').or(
      page.getByText('No recent activity')
    ).first()).toBeVisible();
  });

  test('should handle navigation menu', async ({ page }) => {
    // Click on different nav items
    await page.getByText('Agents').click();
    await expect(page).toHaveURL(/\/agents/);

    await page.getByText('Payments').click();
    await expect(page).toHaveURL(/\/payments/);

    await page.getByText('Settings').click();
    await expect(page).toHaveURL(/\/settings/);
  });
});

test.describe('Dashboard - Agent Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/agents');
  });

  test('should create new agent button visible', async ({ page }) => {
    await expect(page.getByText('Create Agent')).toBeVisible();
  });

  test('should open create agent modal', async ({ page }) => {
    await page.getByText('Create Agent').click();
    
    // Check modal is visible
    await expect(page.getByText('Create New Agent')).toBeVisible();
    
    // Check form fields
    await expect(page.getByLabel('Agent Name')).toBeVisible();
    await expect(page.getByLabel('Description')).toBeVisible();
  });

  test('should validate create agent form', async ({ page }) => {
    await page.getByText('Create Agent').click();
    await page.getByText('Create').click();
    
    // Should show validation errors
    await expect(page.getByText('Name is required')).toBeVisible();
  });
});

test.describe('Dashboard - Payment View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/payments');
  });

  test('should display payment history', async ({ page }) => {
    await expect(page.getByText('Payment History')).toBeVisible();
    
    // Check for payment table or empty state
    const paymentTable = page.locator('table');
    const emptyState = page.getByText('No payments yet');
    
    await expect(paymentTable.or(emptyState).first()).toBeVisible();
  });

  test('should display revenue chart', async ({ page }) => {
    await expect(page.getByText('Revenue Overview')).toBeVisible();
    await expect(page.locator('[data-testid="revenue-chart"]')).toBeVisible();
  });

  test('should filter payments by date', async ({ page }) => {
    // Check date filter exists
    await expect(page.getByText('Filter')).toBeVisible();
    
    // Open filter dropdown
    await page.getByText('Filter').click();
    await expect(page.getByText('Last 7 days')).toBeVisible();
    await expect(page.getByText('Last 30 days')).toBeVisible();
  });
});

test.describe('Dashboard - Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/settings');
  });

  test('should display settings sections', async ({ page }) => {
    await expect(page.getByText('General Settings')).toBeVisible();
    await expect(page.getByText('Wallet Configuration')).toBeVisible();
    await expect(page.getByText('API Keys')).toBeVisible();
  });

  test('should save settings', async ({ page }) => {
    // Update a setting
    const input = page.getByLabel('Display Name');
    await input.fill('Test User');
    
    // Save
    await page.getByText('Save Changes').click();
    
    // Should show success message
    await expect(page.getByText('Settings saved')).toBeVisible();
  });
});
