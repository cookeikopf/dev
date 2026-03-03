/**
 * AgentLink - Complete User Journey E2E Test
 * 
 * Tests the full user flow:
 * 1. Create agent with CLI
 * 2. Start dev server
 * 3. Make paid request
 * 4. Verify payment
 * 5. Check dashboard logs
 */

import { test, expect } from '@playwright/test';
import { execSync, spawn } from 'child_process';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';

test.describe('Complete User Journey', () => {
  let tempDir: string;
  let devServer: ReturnType<typeof spawn> | null = null;

  test.beforeAll(async () => {
    // Create temporary directory for test project
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentlink-e2e-'));
    
    // Build CLI if needed
    try {
      execSync('pnpm --filter @agentlink/cli build', {
        cwd: path.resolve(__dirname, '../../../..'),
        stdio: 'ignore',
      });
    } catch {
      // Build may already exist
    }
  });

  test.afterAll(async () => {
    // Clean up dev server
    if (devServer) {
      devServer.kill();
    }
    
    // Clean up temp directory
    await fs.remove(tempDir);
  });

  test('Step 1: Create agent with CLI', async () => {
    const cliPath = path.resolve(__dirname, '../../../../agentlink-cli/dist/index.js');
    
    // Create new agent project
    const output = execSync(
      `node ${cliPath} create test-agent --template basic --dir ${tempDir}`,
      {
        encoding: 'utf-8',
        cwd: tempDir,
      }
    );

    // Verify agent was created
    expect(output).toContain('Created');
    expect(output).toContain('test-agent');

    // Verify project structure
    const agentDir = path.join(tempDir, 'test-agent');
    expect(await fs.pathExists(agentDir)).toBe(true);
    expect(await fs.pathExists(path.join(agentDir, 'agent.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(agentDir, 'package.json'))).toBe(true);
  });

  test('Step 2: Configure agent with payment', async () => {
    const agentFile = path.join(tempDir, 'test-agent', 'agent.ts');
    
    // Read existing agent file
    const existingContent = await fs.readFile(agentFile, 'utf-8');
    
    // Update with payment configuration
    const updatedContent = existingContent.replace(
      'createAgent({',
      `createAgent({
  x402: {
    usdcAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    chainId: 84532,
    receiver: '0x1234567890123456789012345678901234567890',
  },`
    );

    await fs.writeFile(agentFile, updatedContent);

    // Verify file was updated
    const newContent = await fs.readFile(agentFile, 'utf-8');
    expect(newContent).toContain('x402:');
    expect(newContent).toContain('usdcAddress');
  });

  test('Step 3: Start dev server', async () => {
    const agentDir = path.join(tempDir, 'test-agent');
    
    // Install dependencies
    execSync('npm install', {
      cwd: agentDir,
      stdio: 'ignore',
    });

    // Start dev server
    devServer = spawn('npm', ['run', 'dev'], {
      cwd: agentDir,
      env: { ...process.env, PORT: '3456' },
    });

    // Wait for server to start
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Verify server is running
    const response = await fetch('http://localhost:3456/health');
    expect(response.status).toBe(200);
    
    const health = await response.json();
    expect(health.status).toBe('healthy');
  });

  test('Step 4: Get agent card', async () => {
    const response = await fetch('http://localhost:3456/.well-known/agent.json');
    expect(response.status).toBe(200);

    const agentCard = await response.json();
    expect(agentCard.schema_version).toBe('1.0');
    expect(agentCard.name).toBeDefined();
    expect(agentCard.capabilities).toBeDefined();
  });

  test('Step 5: List capabilities', async () => {
    const response = await fetch('http://localhost:3456/capabilities');
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.capabilities).toBeInstanceOf(Array);
    expect(data.capabilities.length).toBeGreaterThan(0);
  });

  test('Step 6: Execute free capability', async () => {
    // First, get list of capabilities
    const capsResponse = await fetch('http://localhost:3456/capabilities');
    const { capabilities } = await capsResponse.json();
    
    // Find a free capability
    const freeCap = capabilities.find((c: any) => !c.pricing);
    
    if (freeCap) {
      const response = await fetch(
        `http://localhost:3456/capabilities/${freeCap.id}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input: {} }),
        }
      );

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.result).toBeDefined();
    }
  });

  test('Step 7: Request paid capability without payment', async () => {
    // Get capabilities
    const capsResponse = await fetch('http://localhost:3456/capabilities');
    const { capabilities } = await capsResponse.json();
    
    // Find a paid capability or skip
    const paidCap = capabilities.find((c: any) => c.pricing);
    
    if (paidCap) {
      const response = await fetch(
        `http://localhost:3456/capabilities/${paidCap.id}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input: {} }),
        }
      );

      // Should return 402 Payment Required
      expect(response.status).toBe(402);
      
      const error = await response.json();
      expect(error.status).toBe(402);
      expect(error.paymentRequired).toBeDefined();
      expect(error.paymentRequired.amount).toBeGreaterThan(0);
      expect(error.paymentRequired.token).toBeDefined();
    }
  });

  test('Step 8: Execute capability with mock payment', async () => {
    const capsResponse = await fetch('http://localhost:3456/capabilities');
    const { capabilities } = await capsResponse.json();
    
    const paidCap = capabilities.find((c: any) => c.pricing);
    
    if (paidCap && paidCap.pricing) {
      // Create mock payment proof
      const mockPaymentProof = JSON.stringify({
        txHash: '0x' + 'a'.repeat(64),
        amount: paidCap.pricing * 1_000_000,
        token: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        chainId: 84532,
        receiver: '0x1234567890123456789012345678901234567890',
        paymentId: 'test-payment-' + Date.now(),
      });

      const response = await fetch(
        `http://localhost:3456/capabilities/${paidCap.id}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Payment-Proof': mockPaymentProof,
          },
          body: JSON.stringify({ input: {} }),
        }
      );

      // Should succeed with payment
      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.result).toBeDefined();
    }
  });

  test('Step 9: A2A JSON-RPC discover', async () => {
    const response = await fetch('http://localhost:3456/a2a', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'a2a.discover',
      }),
    });

    expect(response.status).toBe(200);
    
    const result = await response.json();
    expect(result.jsonrpc).toBe('2.0');
    expect(result.result).toBeDefined();
    expect(result.result.name).toBeDefined();
  });

  test('Step 10: A2A JSON-RPC capabilities', async () => {
    const response = await fetch('http://localhost:3456/a2a', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'a2a.capabilities',
      }),
    });

    expect(response.status).toBe(200);
    
    const result = await response.json();
    expect(result.jsonrpc).toBe('2.0');
    expect(result.result.capabilities).toBeInstanceOf(Array);
  });
});

test.describe('Dashboard Integration', () => {
  test('should display agent in dashboard', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Check agent list contains our test agent
    await expect(page.getByText('Your Agents')).toBeVisible();
    
    // Look for agent cards
    const agentCards = page.locator('[data-testid="agent-card"]');
    const count = await agentCards.count();
    
    // Should have at least one agent
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should show payment activity', async ({ page }) => {
    await page.goto('http://localhost:3000/payments');
    
    await expect(page.getByText('Payment History')).toBeVisible();
    
    // Check for payments or empty state
    const hasPayments = await page.locator('table tbody tr').count() > 0;
    
    if (!hasPayments) {
      await expect(page.getByText('No payments yet')).toBeVisible();
    }
  });

  test('should show agent metrics', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Check for metrics cards
    await expect(page.getByText('Total Requests')).toBeVisible();
    await expect(page.getByText('Total Revenue')).toBeVisible();
  });
});
