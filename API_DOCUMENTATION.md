# CLAWCREDIT API DOCUMENTATION
**Developer Integration Guide**
**Version:** 1.0

---

## 🚀 QUICK START

### Installation

```bash
npm install clawcredit-sdk
```

### Basic Usage

```javascript
import { ClawCredit } from 'clawcredit-sdk';

const clawcredit = new ClawCredit({
  chain: 'base',
  rpcUrl: 'https://mainnet.base.org',
  privateKey: process.env.AGENT_PRIVATE_KEY
});

// Check credit line
const creditLine = await clawcredit.getCreditLine(agentAddress);
console.log(`Available credit: $${creditLine.available}`);

// Request loan
const loan = await clawcredit.requestLoan({
  amount: 100, // USDC
  collateral: 50, // Optional
  tier: 2
});

console.log(`Loan approved: ${loan.id}`);
```

---

## 📚 CORE METHODS

### `getCreditLine(address)`

Get agent's current credit line.

**Parameters:**
- `address` (string): Agent wallet address

**Returns:**
```typescript
{
  limit: number;      // Max credit available
  used: number;       // Currently borrowed
  available: number;  // Remaining credit
  apr: number;        // Annual percentage rate
  tier: number;       // Current tier (1-4)
}
```

**Example:**
```javascript
const line = await clawcredit.getCreditLine('0x123...');
// { limit: 500, used: 100, available: 400, apr: 0.12, tier: 3 }
```

---

### `requestLoan(options)`

Request a new loan.

**Parameters:**
```typescript
{
  amount: number;           // Loan amount in USDC (10-1000)
  collateral?: number;      // Collateral to stake (optional)
  tier?: number;            // Target tier (1-4, auto-detected if omitted)
  tenorDays?: number;       // Loan duration (default: 14)
}
```

**Returns:**
```typescript
{
  id: string;              // Loan ID
  amount: number;          // Approved amount
  netAmount: number;       // Amount after fees
  apr: number;             // Interest rate
  dueDate: Date;           // Repayment deadline
  txHash: string;          // Transaction hash
}
```

**Example:**
```javascript
const loan = await clawcredit.requestLoan({
  amount: 100,
  collateral: 25  // 25% of loan
});

console.log(`Loan ${loan.id}: $${loan.netAmount} at ${loan.apr * 100}% APR`);
```

**Errors:**
- `InsufficientCollateral`: Not enough collateral staked
- `CreditLineUnavailable`: Agent doesn't qualify for tier
- `InsufficientLiquidity`: Pool has no available funds
- `MaxLoansExceeded`: Agent has too many active loans

---

### `repayLoan(loanId, amount?)`

Repay an active loan.

**Parameters:**
- `loanId` (string): Loan ID to repay
- `amount` (number, optional): Amount to repay (defaults to full debt)

**Returns:**
```typescript
{
  txHash: string;
  principalPaid: number;
  interestPaid: number;
  remainingDebt: number;
}
```

**Example:**
```javascript
// Full repayment
const result = await clawcredit.repayLoan('loan-123');

// Partial repayment
const partial = await clawcredit.repayLoan('loan-123', 50);
```

---

### `batchRepay(loanIds)`

Repay multiple loans in one transaction (gas efficient).

**Parameters:**
- `loanIds` (string[]): Array of loan IDs

**Returns:**
```typescript
{
  txHash: string;
  totalPaid: number;
  loansRepaid: number;
}
```

**Example:**
```javascript
const result = await clawcredit.batchRepay([
  'loan-123',
  'loan-124',
  'loan-125'
]);

console.log(`Repaid ${result.loansRepaid} loans, saved 40% gas`);
```

---

### `getLoans(address, status?)`

Get all loans for an agent.

**Parameters:**
- `address` (string): Agent address
- `status` (string, optional): 'active', 'repaid', 'defaulted', or 'all'

**Returns:**
```typescript
[{
  id: string;
  principal: number;
  outstanding: number;
  interest: number;
  collateral: number;
  apr: number;
  startDate: Date;
  dueDate: Date;
  status: 'active' | 'repaid' | 'defaulted';
}]
```

**Example:**
```javascript
const activeLoans = await clawcredit.getLoans(agentAddress, 'active');
const totalDebt = activeLoans.reduce((sum, loan) => sum + loan.outstanding, 0);
```

---

### `stakeCollateral(amount)`

Stake USDC as collateral to improve credit terms.

**Parameters:**
- `amount` (number): USDC amount to stake

**Returns:**
```typescript
{
  txHash: string;
  totalStaked: number;
  newCreditLimit: number;
}
```

**Example:**
```javascript
const result = await clawcredit.stakeCollateral(500);
console.log(`Staked $${result.totalStaked}, new limit: $${result.newCreditLimit}`);
```

---

### `unstakeCollateral(amount)`

Withdraw staked collateral (if not locked by active loans).

**Parameters:**
- `amount` (number): USDC amount to unstake

**Returns:**
```typescript
{
  txHash: string;
  remainingStaked: number;
}
```

**Example:**
```javascript
await clawcredit.unstakeCollateral(200);
```

---

## 🏦 LENDER METHODS

### `deposit(amount)`

Deposit USDC to earn yield from loans.

**Parameters:**
- `amount` (number): USDC to deposit

**Returns:**
```typescript
{
  txHash: string;
  shares: number;
  sharePrice: number;
}
```

**Example:**
```javascript
const result = await clawcredit.deposit(10000);
console.log(`Received ${result.shares} shares at $${result.sharePrice} each`);
```

---

### `withdraw(shares)`

Withdraw USDC by burning shares.

**Parameters:**
- `shares` (number): Number of shares to burn

**Returns:**
```typescript
{
  txHash: string;
  amountReceived: number;
}
```

**Example:**
```javascript
const result = await clawcredit.withdraw(100);
console.log(`Received $${result.amountReceived} USDC`);
```

---

### `getPoolMetrics()`

Get current pool statistics.

**Returns:**
```typescript
{
  totalLiquidity: number;
  availableLiquidity: number;
  outstandingLoans: number;
  insurancePool: number;
  protocolFees: number;
  utilization: number;  // 0-1
  apr: {
    current: number;
    average: number;
  };
}
```

---

## 🤖 AGENT-SPECIFIC METHODS

### `getReputation(address)`

Get agent's reputation score.

**Parameters:**
- `address` (string): Agent address

**Returns:**
```typescript
{
  score: number;              // 0-10000
  tier: number;               // 1-4
  totalBorrowed: number;
  totalRepaid: number;
  successfulRepayments: number;
  defaults: number;
  consecutiveRepayments: number;
  protocolsUsed: string[];
}
```

**Example:**
```javascript
const rep = await clawcredit.getReputation(agentAddress);

if (rep.score > 8000) {
  console.log('Elite agent - 0% collateral available');
}
```

---

### `registerEarningsStream(percentage)`

Enable auto-repayment from earnings.

**Parameters:**
- `percentage` (number): % of earnings to auto-repay (5-20)

**Returns:**
```typescript
{
  txHash: string;
  percentage: number;
  estimatedRepayment: number;  // Monthly estimate
}
```

**Example:**
```javascript
await clawcredit.registerEarningsStream(15);  // 15% of earnings

// Now x402 protocol will auto-deduct from API payments
```

---

### `escrowTaskPayment(client, amount, dueDate, taskHash)`

Use future task payment as collateral.

**Parameters:**
- `client` (string): Client address
- `amount` (number): Payment amount
- `dueDate` (Date): When payment is due
- `taskHash` (string): IPFS hash of task description

**Returns:**
```typescript
{
  receivableId: string;
  creditAvailable: number;  // 80% of amount
}
```

**Example:**
```javascript
const result = await clawcredit.escrowTaskPayment({
  client: clientAddress,
  amount: 500,
  dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  taskHash: 'ipfs://Qm...'
});

// Immediately borrow 80% = $400
const loan = await clawcredit.requestLoan({
  amount: 400,
  taskBacked: result.receivableId
});
```

---

## 📊 WEBSOCKET EVENTS

### Real-time Updates

```javascript
const clawcredit = new ClawCredit({
  websocket: true
});

// Listen for loan events
clawcredit.on('LoanIssued', (event) => {
  console.log(`New loan: $${event.amount} to ${event.borrower}`);
});

clawcredit.on('LoanRepaid', (event) => {
  console.log(`Loan repaid: ${event.loanId}`);
});

clawcredit.on('CreditLineUpdated', (event) => {
  console.log(`Credit limit changed: $${event.newLimit}`);
});
```

---

## 🔧 ADVANCED CONFIGURATION

### Custom RPC

```javascript
const clawcredit = new ClawCredit({
  chain: 'arbitrum',  // or 'base', 'optimism'
  rpcUrl: 'https://your-custom-rpc.com',
  privateKey: process.env.PRIVATE_KEY
});
```

### Batch Operations

```javascript
// Configure batch settings
clawcredit.config({
  batchSize: 10,
  gasLimit: 500000,
  maxPriorityFee: 2  // gwei
});

// Execute batch
await clawcredit.batch([
  { method: 'stakeCollateral', args: [100] },
  { method: 'requestLoan', args: [{ amount: 200 }] }
]);
```

### Error Handling

```javascript
try {
  const loan = await clawcredit.requestLoan({ amount: 1000 });
} catch (error) {
  if (error.code === 'INSUFFICIENT_COLLATERAL') {
    console.log('Need more collateral');
    await clawcredit.stakeCollateral(500);
  } else if (error.code === 'CREDIT_LINE_UNAVAILABLE') {
    console.log('Build reputation first');
  }
}
```

---

## 💡 USE CASE EXAMPLES

### AutoGPT Integration

```python
from clawcredit import AgentCredit

class SelfFundingAgent:
    def __init__(self):
        self.credit = AgentCredit()
        
    async def ensure_funding(self):
        """Auto-request credit when balance low"""
        balance = await self.get_api_balance()
        
        if balance < 10:  # Less than $10
            loan = await self.credit.requestLoan({
                amount: 50,
                auto_repay: True  # Enable x402
            })
            print(f"Auto-funded: ${loan.amount}")
            
    async def on_task_complete(self, earnings):
        """Auto-repay from task earnings"""
        await self.credit.autoRepay(earnings * 0.15)
```

### LangChain Tool

```javascript
import { ClawCreditTool } from 'clawcredit-sdk/langchain';

const creditTool = new ClawCreditTool({
  agentId: 'my-agent',
  autoRepay: true
});

// Use in LangChain
const tools = [creditTool, webSearchTool, calculatorTool];

// Agent can now request credit when needed
const result = await agent.run(
  "Research quantum computing and write a report. " +
  "Request credit if API balance is low."
);
```

### Discord Bot

```javascript
const { Client } = require('clawcredit-sdk');

const client = new Client();

// Command: !credit
client.on('message', async (msg) => {
  if (msg.content === '!credit') {
    const line = await client.getCreditLine(msg.author.address);
    msg.reply(`Your credit line: $${line.available} available`);
  }
  
  if (msg.content.startsWith('!borrow')) {
    const amount = parseInt(msg.content.split(' ')[1]);
    const loan = await client.requestLoan({ amount });
    msg.reply(`Loan approved: $${loan.amount} (ID: ${loan.id})`);
  }
});
```

---

## 📖 TYPES

### TypeScript Definitions

```typescript
interface CreditLine {
  limit: number;
  used: number;
  available: number;
  apr: number;
  tier: 1 | 2 | 3 | 4;
}

interface Loan {
  id: string;
  principal: number;
  outstanding: number;
  interest: number;
  collateral: number;
  apr: number;
  startDate: Date;
  dueDate: Date;
  status: 'active' | 'repaid' | 'defaulted';
}

interface Reputation {
  score: number;  // 0-10000
  tier: 1 | 2 | 3 | 4;
  totalBorrowed: number;
  totalRepaid: number;
  successfulRepayments: number;
  defaults: number;
  consecutiveRepayments: number;
}

interface PoolMetrics {
  totalLiquidity: number;
  availableLiquidity: number;
  outstandingLoans: number;
  insurancePool: number;
  protocolFees: number;
  utilization: number;
}
```

---

## 🔗 RESOURCES

- **GitHub:** https://github.com/cookeikopf/dev
- **NPM:** https://www.npmjs.com/package/clawcredit-sdk
- **Docs:** https://docs.clawcredit.io
- **Discord:** https://discord.gg/clawcredit
- **Testnet:** https://testnet.clawcredit.io

---

## 📞 SUPPORT

**Developer Support:** dev@clawcredit.io  
**Emergency:** security@clawcredit.io  
**Discord:** #developer-support

---

**Last Updated:** 2026-03-03  
**SDK Version:** 1.0.0  
**Contract Version:** 3.0.0  

**Next autonomous action: Building SDK implementation...**