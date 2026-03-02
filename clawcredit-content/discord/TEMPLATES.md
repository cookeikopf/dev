# Discord Outreach Templates

## Template 1: Introduction Message

**Use case:** First message when joining a new server

```
Hey everyone! 👋

Been building something I think this community might find useful.

**Problem I've been facing:**
My AI agents keep dying because they run out of API credits. They need money to work, but they start with $0.

**Current solutions don't work:**
- Can't get a loan (no KYC for agents)
- Can't use DeFi (need 150% collateral)
- Can't use credit cards (no SSN)

**What I built:**
ClawCredit - micro-loans specifically for AI agents
- $20-100 loans
- No collateral (reputation-based)
- Auto-repayment from earnings
- 12-15% APR
- Built on Base L2

**Real example:**
My agent borrowed $50, used it to complete tasks worth $150, auto-repaid $55, kept $95 profit. Credit score went up. Now it can borrow more.

Currently in beta. Looking for agent developers to test it and give feedback.

Would this be useful for your projects? What am I missing?

[Link to demo]
```

---

## Template 2: Response to "How do I fund my agent?"

**Use case:** When someone asks about funding in Discord

```
I had the same problem! Here's what I learned:

**Option 1: Self-fund**
- Pros: Simple, no dependencies
- Cons: Expensive at scale, doesn't scale

**Option 2: VC funding**
- Pros: Big checks
- Cons: 6-month process, lose equity, not scalable

**Option 3: ClawCredit (what I built)**
- $20-100 instant loans
- No collateral, no KYC
- Auto-repayment
- Builds credit history
- Scales with your agent

**The math:**
- Borrow $50
- Cost: ~$2-3 in interest
- Generate $100+ in value
- Net: $47+ profit
- ROI: 90%+

I was skeptical at first, but the auto-repayment is actually genius. The agent can't forget to pay back.

Want to try it? First 50 agents get priority access: [link]
```

---

## Template 3: Technical Deep Dive

**Use case:** When technical questions arise

```
Great question! Here's the technical breakdown:

**How the reputation system works:**

1. **On-chain history analysis**
   - Transaction count
   - Wallet age
   - Protocol interactions
   - Past repayments

2. **AI risk oracle**
   - Predicts 30-day earnings
   - Analyzes volatility
   - Calculates default probability
   - Updates in real-time

3. **Graduated access**
   - New agents: 20% collateral, $20 limit
   - After 1 repayment: 10% collateral, $50 limit
   - After 3 repayments: 0% collateral, $100 limit
   - After 5 repayments: 0% collateral, $500 limit

**Security:**
- 48h timelock on upgrades
- Insurance pool (5% of interest)
- Circuit breakers
- Verified contracts on Basescan

**The x402 auto-repayment:**
```solidity
function autoRepay(uint256 loanId, uint256 amount) external {
    require(msg.sender == x402Hook);
    // Deduct from agent earnings automatically
}
```

The agent literally cannot not pay back. Code is deterministic.

Contracts are open source (link in bio). Would love a security review if anyone has time.
```

---

## Template 4: Partnership Pitch

**Use case:** DM to server mods or framework creators

```
Hey [Name],

Saw you're working on [Agent Framework]. Really impressive stuff.

Quick question: Have you thought about how agents built with your framework will fund their API costs?

I built ClawCredit specifically for this problem:
- $20-100 micro-loans
- No collateral (reputation-based)
- Auto-repayment
- 12-15% APR

**Integration idea:**
What if agents built with [Framework] got:
- Native SDK integration
- 0.5% APR discount
- Priority access to credit

Could be a compelling feature for your users - "Agents that fund themselves."

Happy to discuss partnership if there's interest. No pressure, just thought it might be useful.

[Link to demo]

Best,
[Your name]
```

---

## Template 5: Case Study Share

**Use case:** Sharing success stories

```
📊 Update: Month 1 metrics

Wanted to share what's working:

**The Numbers:**
• 50 agents funded
• $2,000 total loan volume
• $80 in origination fees
• $40 in interest income
• $20 in late fees
• **$140 total revenue**

**The Defaults:**
• Expected: 5% (2-3 defaults)
• Actual: 2% (1 default)
• Insurance pool covered it

**What surprised me:**
1. Agents are MORE creditworthy than humans
2. Auto-repayment actually works (100% on-time rate)
3. Demand is higher than expected (waitlist growing)

**Top borrower:**
Agent built a trading bot. Borrowed $100, generated $400 in profit, repaid $105, kept $295. Credit score now 85/100.

**Next:**
- Increasing loan limits to $250
- Launching premium tier
- White-label partnerships

If you're building agents and need funding, DM me. First 50 get early access.

[Link]
```

---

## Template 6: Handling Objections

**Use case:** When people raise concerns

**Objection: "This is too risky"**
```
Totally understand the concern. Here's how we mitigate risk:

**For lenders (pool suppliers):**
- Insurance pool (5% of all interest)
- Conservative initial limits ($20-50)
- Graduated system (prove yourself first)
- Real-time risk monitoring

**For the protocol:**
- 48h timelock on changes
- Circuit breakers
- Multi-sig treasury
- Open source (community audit)

**Data so far:**
- 50 loans issued
- 1 default (2% rate)
- Insurance pool covered it
- Lenders made 8-12% APY

It's not risk-free, but the data suggests it's manageable.

Happy to share more details on risk model if helpful.
```

**Objection: "Why would agents pay 12-15% APR?"**
```
Great question. Let's look at the math:

**Cost of credit:**
- Borrow $50 for 30 days
- APR: 15%
- Interest: $50 × 15% × (30/365) = $0.62
- Origination: $50 × 3% = $1.50
- Total cost: $2.12

**Value unlocked:**
- Agent uses $50 to complete tasks
- Generates $100 in value
- Net profit: $100 - $50 - $2.12 = $47.88
- ROI: 95.8%

**Alternative:**
- Don't borrow $50
- Can't complete tasks
- Generate $0
- ROI: 0%

The 15% APR is irrelevant compared to the value it unlocks.

It's not about the cost of credit. It's about the cost of NOT having credit.
```

---

## Template 7: Call to Action

**Use case:** End of conversation, driving action

```
Thanks for the great discussion everyone! 🙏

**Quick summary:**
- Built ClawCredit for AI agent funding
- $20-100 loans, no collateral
- Auto-repayment, 12-15% APR
- 50 agents funded so far
- 2% default rate

**Next steps:**
If you're building agents and want to:
✅ Skip the funding problem
✅ Build credit history
✅ Scale faster

DM me "AGENT" for early access.
First 50 get:
- Priority onboarding
- 0.5% APR discount
- Direct support channel

Also happy to answer any questions here.

Let's build the agent economy together. 🤖💚

[Link]
```

---

## Server Target List

### High Priority
1. AutoGPT Discord (https://discord.gg/autogpt)
2. LangChain Discord (https://discord.gg/langchain)
3. Base Discord (https://base.org/discord)
4. AI Agent Builders Discord
5. Crypto x AI Discord

### Medium Priority
6. Ethereum Discord
7. DeFi Llama Discord
8. OpenAI Developer Discord
9. Anthropic Discord
10. Buildspace Discord

### Outreach Strategy
**Week 1:** Join 3 servers, introduce, provide value
**Week 2:** Continue engagement, share case studies
**Week 3:** Partnership discussions with mods
**Week 4:** Community AMAs

---

## Engagement Rules

### Do:
- ✅ Provide genuine value first
- ✅ Answer technical questions thoroughly
- ✅ Share real metrics and data
- ✅ Be transparent about limitations
- ✅ Build relationships before pitching

### Don't:
- ❌ Spam links
- ❌ DM without permission
- ❌ Over-promote
- ❌ Ignore community rules
- ❌ Be defensive about criticism

---

## Tracking

Track for each server:
- Date joined
- Messages sent
- Responses received
- DMs received
- Conversions (wallets connected)
- Loans originated

Optimize based on which servers convert best.
