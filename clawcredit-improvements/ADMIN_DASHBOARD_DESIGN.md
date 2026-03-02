# ClawCredit Admin Dashboard - Design Spec

## Overview
Real-time monitoring and control panel for ClawCredit protocol.

## Layout

```
┌─────────────────────────────────────────────────────────────┐
│  CLAWCREDIT ADMIN                      [Alerts] [Settings]  │
├─────────────────┬───────────────────────────────────────────┤
│                 │                                           │
│  NAVIGATION     │  METRICS CARDS                            │
│                 │  ┌────────┐ ┌────────┐ ┌────────┐        │
│  📊 Dashboard   │  │Pool    │ │Revenue │ │Agents  │        │
│  💰 Treasury    │  │$0      │ │$0      │ │0       │        │
│  📈 Analytics   │  └────────┘ └────────┘ └────────┘        │
│  ⚠️ Risks       │  ┌────────┐ ┌────────┐ ┌────────┐        │
│  🔧 Settings    │  │Loans   │ │Default │ │Health  │        │
│                 │  │0       │ │0%      │ │🟢 Good │        │
│  ─────────────  │  └────────┘ └────────┘ └────────┘        │
│                 │                                           │
│  QUICK ACTIONS  │  CHARTS                                   │
│                 │  ┌─────────────────────────────────────┐ │
│  [Fund Pool]    │  │  Loan Volume (7 days)              │ │
│  [Pause Proto]  │  │                                    │ │
│  [Emergency]    │  │  📈 (waiting for data)             │ │
│                 │  └─────────────────────────────────────┘ │
│                 │                                           │
│                 │  RECENT ACTIVITY                          │
│                 │  ┌─────────────────────────────────────┐ │
│                 │  │ No recent activity                  │ │
│                 │  │ Fund pool to see transactions       │ │
│                 │  └─────────────────────────────────────┘ │
│                 │                                           │
└─────────────────┴───────────────────────────────────────────┘
```

## Components

### 1. Header
- Logo + "ADMIN" badge
- Real-time clock
- Alert indicator (red badge if issues)
- Settings dropdown

### 2. Navigation Sidebar
```
Dashboard (overview)
Treasury (deposits/withdrawals)
Analytics (charts/reports)
Risks (default monitoring)
Settings (protocol params)
```

### 3. Metrics Cards

**Pool Card**
```
┌────────────────┐
│  💧 Pool       │
│                │
│  $12,450       │
│  ━━━━━━━━━━━   │
│  83% utilized  │
│                │
│  +$500 today   │
└────────────────┘
```

**Revenue Card**
```
┌────────────────┐
│  💰 Revenue    │
│                │
│  $1,234        │
│  ━━━━━━━━━━━   │
│  This month    │
│                │
│  +12% vs last  │
└────────────────┘
```

**Agents Card**
```
┌────────────────┐
│  🤖 Agents     │
│                │
│  156           │
│  ━━━━━━━━━━━   │
│  12 new today  │
│                │
│  89% retention │
└────────────────┘
```

**Loans Card**
```
┌────────────────┐
│  📄 Loans      │
│                │
│  89            │
│  ━━━━━━━━━━━   │
│  23 active     │
│                │
│  66 repaid     │
└────────────────┘
```

**Default Rate Card**
```
┌────────────────┐
│  ⚠️ Default    │
│                │
│  2.3%          │
│  ━━━━━━━━━━━   │
│  Target: <5%   │
│                │
│  🟢 On target  │
└────────────────┘
```

**Health Card**
```
┌────────────────┐
│  ❤️ Health     │
│                │
│  94/100        │
│  ━━━━━━━━━━━   │
│  🟢 Excellent  │
│                │
│  No issues     │
└────────────────┘
```

### 4. Charts

**Loan Volume Chart**
- Type: Line chart
- Time range: 7 days, 30 days, 90 days
- Data: Daily loan volume
- Trend line

**Agent Growth Chart**
- Type: Area chart
- Time range: 30 days
- Data: Cumulative agents
- Growth rate indicator

**Default Rate Chart**
- Type: Line chart
- Time range: 30 days
- Data: Rolling 7-day default rate
- Target line at 5%

**Revenue Chart**
- Type: Stacked bar
- Time range: 30 days
- Data: Origination fees + Interest + Late fees
- Daily breakdown

### 5. Recent Activity Feed
```
┌─────────────────────────────────────┐
│ Recent Activity                     │
├─────────────────────────────────────┤
│ 🟢 Loan #123 repaid - $55          │
│   Agent: 0x123...abc                │
│   2 minutes ago                     │
├─────────────────────────────────────┤
│ 🟡 Loan #124 issued - $50          │
│   Agent: 0x456...def                │
│   5 minutes ago                     │
├─────────────────────────────────────┤
│ 💰 Deposit - $1,000                │
│   From: 0x789...ghi                 │
│   12 minutes ago                    │
├─────────────────────────────────────┤
│ ⚠️ Late fee charged - $1           │
│   Loan #100                         │
│   1 hour ago                        │
└─────────────────────────────────────┘
```

### 6. Quick Actions

**Fund Pool Button**
```
[ Fund Pool ]
Opens modal to deposit USDC
```

**Pause Protocol Button**
```
[ ⚠️ Pause Protocol ]
Red button, confirmation required
Circuit breaker activation
```

**Emergency Withdrawal Button**
```
[ 🚨 Emergency Withdrawal ]
Requires 2-of-3 guardian approval
48h timelock
```

## Pages

### Dashboard (Main)
- All metrics cards
- Key charts
- Activity feed
- Quick actions

### Treasury Page
```
Deposits
├─ Total deposits: $X
├─ Emergency reserve: $X
└─ Available liquidity: $X

Withdrawals
├─ Pending requests
├─ Approved requests  
└─ Executed withdrawals

Fee Income
├─ Origination fees: $X
├─ Interest income: $X
├─ Late fees: $X
└─ Total: $X
```

### Analytics Page
```
Loan Analytics
├─ Average loan size: $X
├─ Average APR: X%
├─ Average repayment time: X days
└─ Cohort analysis

Agent Analytics
├─ New agents (7d, 30d, 90d)
├─ Retention rate
├─ LTV by cohort
└─ Churn analysis

Revenue Analytics
├─ MRR (Monthly Recurring Revenue)
├─ Revenue per agent
├─ Revenue per loan
└─ Growth rate
```

### Risks Page
```
Default Monitoring
├─ Current default rate: X%
├─ Default rate by tier
├─ Trending defaults
└─ Early warning alerts

Liquidity Risk
├─ Utilization rate: X%
├─ Days of runway: X
├─ Withdrawal queue
└─ Insurance pool: $X

Credit Risk
├─ Average credit score
├─ Score distribution
├─ Risk concentration
└─ Large exposure alerts
```

### Settings Page
```
Protocol Parameters
├─ Min loan: $X
├─ Max loan: $X
├─ Base APR: X%
├─ Origination fee: X%
└─ Late fee: X%/day

Guardian Management
├─ Current guardians
├─ Add/remove guardians
└─ Approval threshold

Circuit Breakers
├─ Default rate threshold: X%
├─ Daily loan limit: X
├─ Max withdrawal: $X
└─ Toggle switches
```

## Technical Spec

### Stack
- Frontend: React + TypeScript
- Styling: Tailwind CSS
- Charts: Recharts
- State: Zustand
- Web3: ethers.js

### Data Refresh
- Real-time: Every 10 seconds
- Charts: Every 60 seconds
- Background sync: Every 5 minutes

### Alerts
```javascript
// Alert conditions
const alerts = {
  CRITICAL: [
    'defaultRate > 10%',
    'liquidity < 24h runway',
    'contractPaused'
  ],
  WARNING: [
    'defaultRate > 5%',
    'liquidity < 7 days',
    'dailyLoans > 80% of limit'
  ],
  INFO: [
    'newMilestone (100th loan, etc.)',
    'revenueGoalReached'
  ]
};
```

### Access Control
```javascript
// Roles
const roles = {
  OWNER: ['all'],
  GUARDIAN: ['pause', 'breakCircuit', 'approveEmergency'],
  VIEWER: ['viewOnly']
};
```

## Mock Data for Development

```javascript
const mockData = {
  pool: {
    balance: 12450,
    utilization: 83,
    dailyChange: 500
  },
  revenue: {
    total: 1234,
    thisMonth: 890,
    change: 12
  },
  agents: {
    total: 156,
    newToday: 12,
    retention: 89
  },
  loans: {
    total: 89,
    active: 23,
    repaid: 66
  },
  defaults: {
    rate: 2.3,
    target: 5,
    status: 'good'
  }
};
```

## Implementation Priority

**Phase 1 (Week 1):**
- [ ] Dashboard layout
- [ ] Metrics cards
- [ ] Basic charts
- [ ] Real-time data

**Phase 2 (Week 2):**
- [ ] Treasury page
- [ ] Analytics page
- [ ] Export reports

**Phase 3 (Week 3):**
- [ ] Risks page
- [ ] Alerts system
- [ ] Mobile responsive

**Phase 4 (Week 4):**
- [ ] Settings page
- [ ] Guardian controls
- [ ] Emergency functions

## Success Metrics

- Load time: <2 seconds
- Data freshness: <10 seconds
- Uptime: 99.9%
- Mobile support: iOS + Android
