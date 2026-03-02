# ClawCredit Analytics Tracking

## Overview
Track everything. Optimize relentlessly.

## Key Metrics Dashboard

### Financial Metrics
```javascript
// Track daily
const metrics = {
  // Pool Health
  poolLiquidity: 0,        // USDC in pool
  totalDeposits: 0,        // Cumulative deposits
  availableToBorrow: 0,    // Liquidity - active loans
  
  // Loan Metrics
  totalLoans: 0,           // Cumulative loans issued
  activeLoans: 0,          // Currently outstanding
  totalVolume: 0,          // USD value of all loans
  averageLoanSize: 0,      // Total volume / total loans
  
  // Repayment
  loansRepaid: 0,          // Successfully repaid
  loansDefaulted: 0,       // Charged off
  repaymentRate: 0,        // Repaid / (repaid + defaulted)
  averageRepaymentTime: 0, // Days to repay
  
  // Revenue
  originationFees: 0,      // 3% of principal
  interestIncome: 0,       // APR earnings
  lateFees: 0,             // 2% per day
  totalRevenue: 0,         // Sum of all
  
  // Defaults
  defaultRate: 0,          // Defaults / total loans
  insurancePool: 0,        // 5% of interest
  lossReserve: 0           // Buffer for defaults
};
```

### User Metrics
```javascript
const userMetrics = {
  // Acquisition
  totalBorrowers: 0,       // Unique borrowers
  newBorrowersDaily: 0,    // New today
  newBorrowersWeekly: 0,   // New this week
  newBorrowersMonthly: 0,  // New this month
  
  // Engagement
  activeBorrowers: 0,      // Has active loan
  returningBorrowers: 0,   // 2+ loans
  churnedBorrowers: 0,     // No loan in 60 days
  
  // Retention
  retentionRate: 0,        // Return for 2nd loan
  ltv: 0,                  // Lifetime value per borrower
  
  // Referrals
  referralSignups: 0,      // Used referral code
  referralConversions: 0,  // Referred users who borrowed
  viralCoefficient: 0      // Referrals per user
};
```

### Marketing Metrics
```javascript
const marketingMetrics = {
  // Traffic
  websiteVisits: 0,
  uniqueVisitors: 0,
  bounceRate: 0,
  timeOnSite: 0,
  
  // Conversion
  walletConnects: 0,       // Clicked "Connect"
  loanApplications: 0,     // Started application
  loansApproved: 0,        // Approved (should = totalLoans)
  conversionRate: 0,       // Visits → Loans
  
  // Channel Attribution
  twitterReferrals: 0,
  redditReferrals: 0,
  discordReferrals: 0,
  githubReferrals: 0,
  organicReferrals: 0,
  
  // CAC by Channel
  cacTwitter: 0,           // Cost per borrower
  cacReddit: 0,
  cacDiscord: 0,
  cacOverall: 0
};
```

### Risk Metrics
```javascript
const riskMetrics = {
  // Credit Quality
  averageCreditScore: 0,   // 0-100
  scoreDistribution: {
    bronze: 0,             // 0-50
    silver: 0,             // 50-70
    gold: 0,               // 70-90
    platinum: 0            // 90-100
  },
  
  // Default Analysis
  defaultByTier: {
    bronze: 0,
    silver: 0,
    gold: 0,
    platinum: 0
  },
  
  // Loan Performance
  aprByTier: {
    bronze: 15,
    silver: 13,
    gold: 11,
    platinum: 8
  },
  
  // Liquidity Risk
  utilizationRate: 0,      // Active loans / Total deposits
  runway: 0                // Days of liquidity at current rate
};
```

## Tracking Implementation

### Contract Events
```solidity
// Add to ClawCreditPool.sol

event MetricsLoanIssued(
    uint256 loanId,
    address agent,
    uint256 principal,
    uint256 apr,
    uint256 timestamp
);

event MetricsLoanRepaid(
    uint256 loanId,
    address agent,
    uint256 principal,
    uint256 interest,
    uint256 daysToRepay,
    uint256 timestamp
);

event MetricsDefault(
    uint256 loanId,
    address agent,
    uint256 lossAmount,
    uint256 timestamp
);

event MetricsReferral(
    address referee,
    address referrer,
    uint256 timestamp
);
```

### Frontend Tracking
```javascript
// analytics.js

class ClawCreditAnalytics {
  constructor() {
    this.events = [];
    this.sessionId = this.generateSessionId();
  }
  
  // Page Views
  trackPageView(page) {
    this.track('page_view', {
      page: page,
      referrer: document.referrer,
      timestamp: Date.now()
    });
  }
  
  // Wallet Connection
  trackWalletConnect(walletAddress) {
    this.track('wallet_connect', {
      address: walletAddress,
      timestamp: Date.now()
    });
  }
  
  // Loan Application Funnel
  trackLoanStart() {
    this.track('loan_start', { timestamp: Date.now() });
  }
  
  trackLoanAmountSelected(amount) {
    this.track('loan_amount_selected', { amount, timestamp: Date.now() });
  }
  
  trackLoanSubmitted() {
    this.track('loan_submitted', { timestamp: Date.now() });
  }
  
  trackLoanApproved(loanId, amount) {
    this.track('loan_approved', { loanId, amount, timestamp: Date.now() });
  }
  
  trackLoanRejected(reason) {
    this.track('loan_rejected', { reason, timestamp: Date.now() });
  }
  
  // Repayment
  trackRepaymentStart(loanId) {
    this.track('repayment_start', { loanId, timestamp: Date.now() });
  }
  
  trackRepaymentComplete(loanId, amount) {
    this.track('repayment_complete', { loanId, amount, timestamp: Date.now() });
  }
  
  // Referrals
  trackReferralClick(code) {
    this.track('referral_click', { code, timestamp: Date.now() });
  }
  
  trackReferralSignup(referrer, referee) {
    this.track('referral_signup', { referrer, referee, timestamp: Date.now() });
  }
  
  // Base tracking method
  track(eventName, properties) {
    const event = {
      event: eventName,
      properties: {
        ...properties,
        sessionId: this.sessionId,
        userAgent: navigator.userAgent,
        url: window.location.href
      }
    };
    
    this.events.push(event);
    
    // Send to analytics endpoint
    this.sendToServer(event);
    
    // Also log to console in development
    console.log('[Analytics]', event);
  }
  
  sendToServer(event) {
    // POST to your analytics endpoint
    fetch('https://api.clawcredit.io/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event)
    }).catch(err => console.error('Analytics error:', err));
  }
  
  generateSessionId() {
    return Math.random().toString(36).substring(2, 15);
  }
}

// Initialize
const analytics = new ClawCreditAnalytics();

// Track page view on load
analytics.trackPageView(window.location.pathname);
```

### Daily Report Generation
```javascript
// daily-report.js

async function generateDailyReport() {
  const report = {
    date: new Date().toISOString().split('T')[0],
    
    // Financial Summary
    financial: {
      revenue: await getDailyRevenue(),
      loansIssued: await getDailyLoans(),
      repayments: await getDailyRepayments(),
      defaults: await getDailyDefaults()
    },
    
    // User Growth
    users: {
      newBorrowers: await getNewBorrowers(),
      activeBorrowers: await getActiveBorrowers(),
      retention: await getRetentionRate()
    },
    
    // Marketing
    marketing: {
      websiteVisits: await getWebsiteVisits(),
      conversionRate: await getConversionRate(),
      topChannel: await getTopChannel()
    },
    
    // Risks
    risk: {
      defaultRate: await getDefaultRate(),
      utilization: await getUtilization(),
      runway: await getRunway()
    }
  };
  
  // Save to file
  fs.writeFileSync(
    `/reports/daily-${report.date}.json`,
    JSON.stringify(report, null, 2)
  );
  
  // Send notification if metrics are concerning
  if (report.risk.defaultRate > 0.05) {
    sendAlert('Default rate exceeded 5%');
  }
  
  if (report.risk.runway < 7) {
    sendAlert('Liquidity runway below 7 days');
  }
  
  return report;
}

// Run daily
setInterval(generateDailyReport, 24 * 60 * 60 * 1000);
```

## A/B Testing Framework

### Test Ideas
```javascript
const abTests = {
  // Test 1: Headline
  headline: {
    control: "The Bank for AI Agents",
    variant: "Borrow $20-100 with No Collateral",
    metric: "wallet_connects"
  },
  
  // Test 2: CTA Button
  ctaButton: {
    control: "Connect Wallet",
    variant: "Get Started",
    metric: "wallet_connects"
  },
  
  // Test 3: Loan Slider Default
  loanDefault: {
    control: 50,    // $50 default
    variant: 30,    // $30 default
    metric: "loan_applications"
  },
  
  // Test 4: Trust Signals
  trustSignals: {
    control: false, // No badges
    variant: true,  // Show "Verified" badges
    metric: "conversion_rate"
  },
  
  // Test 5: Social Proof
  socialProof: {
    control: "50+ agents funded",
    variant: "$2,000+ loan volume",
    metric: "loan_applications"
  }
};
```

### A/B Test Implementation
```javascript
function getVariant(testName) {
  // 50/50 split based on wallet address
  const wallet = localStorage.getItem('wallet');
  const hash = wallet ? hashCode(wallet) : Math.random();
  return hash % 2 === 0 ? 'control' : 'variant';
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// Usage
const headlineVariant = getVariant('headline');
const headline = abTests.headline[headlineVariant];
```

## Reporting Dashboard

### Daily Slack Report
```
📊 ClawCredit Daily Report - 2026-03-02

💰 Financials
• Revenue: $4.20 (+15% vs yesterday)
• Loans: 3 issued, 2 repaid
• Volume: $90 (+20%)

👥 Users
• New borrowers: 2
• Active: 5
• Retention: 80%

📈 Marketing
• Website visits: 45
• Conversion: 6.7%
• Top channel: Twitter

⚠️ Alerts
• None

🎯 Week Goal: 10 borrowers (7/10)
```

### Weekly Executive Summary
```
📈 ClawCredit Week 2 Summary

Revenue: $12 (vs $4 Week 1) = +200%
Borrowers: 8 (vs 3 Week 1) = +167%
Volume: $240 (vs $90 Week 1) = +167%

Top Performing Channel: Twitter (40% of borrowers)
Best Converting Page: Referral landing (12% vs 6% average)

Next Week Focus:
1. Scale Twitter content
2. Launch referral program
3. Onboard first 2 partnerships
```

## Actionable Insights

### If Conversion Rate < 3%:
- Simplify loan application
- Add more trust signals
- Reduce friction (fewer clicks)
- A/B test headlines

### If Default Rate > 5%:
- Tighten credit requirements
- Lower initial loan limits
- Increase collateral for new agents
- Improve risk oracle

### If CAC > $20:
- Focus on organic channels
- Improve landing page
- Launch referral program
- Reduce paid marketing

### If Retention < 50%:
- Add email reminders
- Offer incentives for 2nd loan
- Improve borrower experience
- Create loyalty program
