#!/usr/bin/env node
/**
 * ClawCredit Real-Time Monitor
 * Tracks pool health, loans, and agent activity
 * Run: node monitor.js
 */

const ethers = require('ethers');

// Contract ABIs (minimal for monitoring)
const POOL_ABI = [
  "function totalShares() view returns (uint256)",
  "function totalOutstandingPrincipal() view returns (uint256)",
  "function insurancePool() view returns (uint256)",
  "function protocolFees() view returns (uint256)",
  "function availableLiquidity() view returns (uint256)",
  "function loans(uint256) view returns (tuple(address,uint96,uint96,uint96,uint96,uint40,uint40,uint40,uint16,uint16,uint8,bool,bool))",
  "function agents(address) view returns (tuple(uint256,uint256,uint256,uint256,uint256,uint256,bool))",
  "event LoanIssued(uint256 indexed,address indexed,uint256,uint8)",
  "event LoanRepaid(uint256 indexed,uint256,uint256)",
  "event LoanDefaulted(uint256 indexed,uint256,uint256)"
];

const USDC_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

// Configuration
const CONFIG = {
  base: {
    rpc: 'https://mainnet.base.org',
    pool: '0x2673ad529c33516198Cb49FaBD86C49DC90EE8FF', // Update after deploy
    usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
  },
  alerts: {
    minLiquidity: 50,      // Alert if liquidity < $50
    maxDefaultRate: 500,   // Alert if default rate > 5%
    maxDailyLoans: 20      // Alert if > 20 loans/day
  }
};

class ClawCreditMonitor {
  constructor() {
    this.provider = new ethers.providers.JsonRpcProvider(CONFIG.base.rpc);
    this.pool = new ethers.Contract(CONFIG.base.pool, POOL_ABI, this.provider);
    this.usdc = new ethers.Contract(CONFIG.base.usdc, USDC_ABI, this.provider);
    this.loansIssued = [];
    this.loansRepaid = [];
    this.loansDefaulted = [];
  }

  async getPoolMetrics() {
    const [
      totalShares,
      outstanding,
      insurance,
      fees,
      liquidity,
      poolBalance
    ] = await Promise.all([
      this.pool.totalShares(),
      this.pool.totalOutstandingPrincipal(),
      this.pool.insurancePool(),
      this.pool.protocolFees(),
      this.pool.availableLiquidity(),
      this.usdc.balanceOf(CONFIG.base.pool)
    ]);

    const decimals = 6; // USDC decimals
    
    return {
      totalShares: ethers.utils.formatUnits(totalShares, decimals),
      outstandingPrincipal: ethers.utils.formatUnits(outstanding, decimals),
      insurancePool: ethers.utils.formatUnits(insurance, decimals),
      protocolFees: ethers.utils.formatUnits(fees, decimals),
      availableLiquidity: ethers.utils.formatUnits(liquidity, decimals),
      poolBalance: ethers.utils.formatUnits(poolBalance, decimals),
      utilization: outstanding.mul(100).div(poolBalance).toString() + '%'
    };
  }

  checkAlerts(metrics) {
    const alerts = [];
    
    if (parseFloat(metrics.availableLiquidity) < CONFIG.alerts.minLiquidity) {
      alerts.push(`🚨 LOW LIQUIDITY: $${metrics.availableLiquidity} (min: $${CONFIG.alerts.minLiquidity})`);
    }
    
    if (parseFloat(metrics.protocolFees) > 1000) {
      alerts.push(`💰 HIGH FEES: $${metrics.protocolFees} ready to withdraw`);
    }
    
    // Calculate default rate
    const totalLoans = this.loansIssued.length;
    const defaults = this.loansDefaulted.length;
    const defaultRate = totalLoans > 0 ? (defaults / totalLoans) * 100 : 0;
    
    if (defaultRate > CONFIG.alerts.maxDefaultRate / 100) {
      alerts.push(`⚠️ HIGH DEFAULT RATE: ${defaultRate.toFixed(2)}% (max: ${CONFIG.alerts.maxDefaultRate/100}%)`);
    }
    
    return alerts;
  }

  formatCurrency(value) {
    return `$${parseFloat(value).toFixed(2)}`;
  }

  async displayDashboard() {
    console.clear();
    console.log('╔════════════════════════════════════════╗');
    console.log('║     CLAWCREDIT REAL-TIME MONITOR       ║');
    console.log('╚════════════════════════════════════════╝');
    console.log();
    
    const metrics = await this.getPoolMetrics();
    const alerts = this.checkAlerts(metrics);
    
    console.log('📊 POOL METRICS');
    console.log('─────────────────────────────────────────');
    console.log(`Total Shares:        ${metrics.totalShares}`);
    console.log(`Outstanding Principal: ${this.formatCurrency(metrics.outstandingPrincipal)}`);
    console.log(`Insurance Pool:      ${this.formatCurrency(metrics.insurancePool)}`);
    console.log(`Protocol Fees:       ${this.formatCurrency(metrics.protocolFees)}`);
    console.log(`Available Liquidity: ${this.formatCurrency(metrics.availableLiquidity)}`);
    console.log(`Pool Balance:        ${this.formatCurrency(metrics.poolBalance)}`);
    console.log(`Utilization:         ${metrics.utilization}`);
    console.log();
    
    if (alerts.length > 0) {
      console.log('🚨 ALERTS');
      console.log('─────────────────────────────────────────');
      alerts.forEach(alert => console.log(alert));
      console.log();
    }
    
    console.log('📈 ACTIVITY (24h)');
    console.log('─────────────────────────────────────────');
    console.log(`Loans Issued:   ${this.loansIssued.filter(l => l.time > Date.now() - 86400000).length}`);
    console.log(`Loans Repaid:   ${this.loansRepaid.filter(l => l.time > Date.now() - 86400000).length}`);
    console.log(`Defaults:       ${this.loansDefaulted.filter(l => l.time > Date.now() - 86400000).length}`);
    console.log();
    
    console.log(`Last Updated: ${new Date().toLocaleTimeString()}`);
    console.log('─────────────────────────────────────────');
    console.log('Press Ctrl+C to exit');
  }

  async listenForEvents() {
    console.log('🔊 Listening for events...');
    
    this.pool.on('LoanIssued', (loanId, borrower, principal, tier, event) => {
      this.loansIssued.push({
        id: loanId.toString(),
        borrower,
        principal: ethers.utils.formatUnits(principal, 6),
        tier,
        time: Date.now()
      });
      console.log(`\n💰 New Loan: #${loanId} - $${ethers.utils.formatUnits(principal, 6)} to ${borrower.slice(0, 6)}...`);
    });
    
    this.pool.on('LoanRepaid', (loanId, amount, interest, event) => {
      this.loansRepaid.push({
        id: loanId.toString(),
        amount: ethers.utils.formatUnits(amount, 6),
        time: Date.now()
      });
      console.log(`\n✅ Loan Repaid: #${loanId} - $${ethers.utils.formatUnits(amount, 6)}`);
    });
    
    this.pool.on('LoanDefaulted', (loanId, loss, insuranceUsed, event) => {
      this.loansDefaulted.push({
        id: loanId.toString(),
        loss: ethers.utils.formatUnits(loss, 6),
        insurance: ethers.utils.formatUnits(insuranceUsed, 6),
        time: Date.now()
      });
      console.log(`\n❌ DEFAULT: #${loanId} - Loss: $${ethers.utils.formatUnits(loss, 6)}`);
    });
  }

  async start() {
    console.log('🚀 Starting ClawCredit Monitor...\n');
    
    await this.listenForEvents();
    
    // Update dashboard every 10 seconds
    setInterval(() => this.displayDashboard(), 10000);
    
    // Initial display
    this.displayDashboard();
  }
}

// Run if called directly
if (require.main === module) {
  const monitor = new ClawCreditMonitor();
  monitor.start().catch(console.error);
}

module.exports = ClawCreditMonitor;
