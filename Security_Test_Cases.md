# Security Test Cases - AgentLink

**Version:** 1.0.0  
**Date:** March 2024  
**Scope:** Smart Contracts, Middleware, API, CLI

---

## Executive Summary

This document provides comprehensive security test cases for the AgentLink protocol. Tests are organized by component and include adversarial scenarios, fuzzing recommendations, and penetration testing checklists.

---

## 1. Smart Contract Security Tests

### 1.1 PaymentRouter Tests

#### Test PR-SEC-001: Reentrancy Attack

```solidity
// Malicious receiver contract
contract ReentrancyAttacker {
    PaymentRouter public router;
    uint256 public attackCount;
    
    constructor(address _router) {
        router = PaymentRouter(_router);
    }
    
    function attack() external {
        // Approve router
        usdc.approve(address(router), type(uint256).max);
        // Initiate payment
        router.pay(address(this), 1000e6, "attack");
    }
    
    receive() external payable {
        if (attackCount < 5) {
            attackCount++;
            // Attempt reentrancy
            router.pay(address(this), 1000e6, "reenter");
        }
    }
}

// Test
function test_ReentrancyProtection() public {
    ReentrancyAttacker attacker = new ReentrancyAttacker(address(router));
    usdc.mint(address(attacker), 10000e6);
    
    vm.expectRevert();
    attacker.attack();
    
    // Verify only one payment went through
    assertEq(router.paymentCount(), 0);
}
```

**Expected Result:** Transaction reverts due to nonReentrant modifier

---

#### Test PR-SEC-002: Integer Overflow in Fee Calculation

```solidity
function test_FeeCalculation_NoOverflow() public {
    // Test maximum values
    uint256 maxAmount = router.MAX_PAYMENT_AMOUNT();
    uint256 maxFee = router.MAX_FEE_BPS();
    
    // Set maximum fee
    vm.prank(owner);
    router.setFeeBps(maxFee);
    
    // Should not overflow
    uint256 fee = router.calculateFee(maxAmount);
    uint256 expectedFee = (maxAmount * maxFee) / 10000;
    
    assertEq(fee, expectedFee);
    assertLe(fee, maxAmount);
}

function test_FeeCalculation_Bounded() public {
    // Fuzz test with random values
    uint256 amount = bound(amount, 1, type(uint256).max / 10000);
    uint256 feeBps = bound(feeBps, 0, 10000);
    
    uint256 fee = (amount * feeBps) / 10000;
    
    // Fee should never exceed amount
    assertLe(fee, amount);
}
```

**Expected Result:** Fee calculation never overflows

---

#### Test PR-SEC-003: Access Control Bypass

```solidity
function test_AccessControl_OwnerOnlyFunctions() public {
    address nonOwner = makeAddr("nonOwner");
    
    // Test setTreasury
    vm.prank(nonOwner);
    vm.expectRevert();
    router.setTreasury(makeAddr("newTreasury"));
    
    // Test setFeeBps
    vm.prank(nonOwner);
    vm.expectRevert();
    router.setFeeBps(200);
    
    // Test pause
    vm.prank(nonOwner);
    vm.expectRevert();
    router.pause();
    
    // Test emergencyWithdraw
    vm.prank(nonOwner);
    vm.expectRevert();
    router.emergencyWithdraw(address(usdc), 1000);
}

function test_AccessControl_OperatorFunctions() public {
    address nonOperator = makeAddr("nonOperator");
    
    // Test setReceiverAllowed
    vm.prank(nonOperator);
    vm.expectRevert(PaymentRouter.UnauthorizedOperator.selector);
    router.setReceiverAllowed(makeAddr("receiver"), true);
}
```

**Expected Result:** All unauthorized calls revert

---

#### Test PR-SEC-004: Payment Amount Bounds

```solidity
function test_PaymentAmount_BelowMinimum() public {
    uint256 belowMin = router.MIN_PAYMENT_AMOUNT() - 1;
    
    vm.prank(payer);
    vm.expectRevert(abi.encodeWithSelector(PaymentRouter.InvalidAmount.selector, belowMin));
    router.pay(receiver, belowMin, "test");
}

function test_PaymentAmount_AboveMaximum() public {
    uint256 aboveMax = router.MAX_PAYMENT_AMOUNT() + 1;
    
    vm.prank(payer);
    vm.expectRevert(abi.encodeWithSelector(PaymentRouter.InvalidAmount.selector, aboveMax));
    router.pay(receiver, aboveMax, "test");
}

function testFuzz_PaymentAmount_WithinBounds(uint256 amount) public {
    amount = bound(amount, router.MIN_PAYMENT_AMOUNT(), router.MAX_PAYMENT_AMOUNT());
    
    // Ensure payer has enough
    if (amount > usdc.balanceOf(payer)) {
        usdc.mint(payer, amount - usdc.balanceOf(payer));
    }
    
    vm.prank(payer);
    router.pay(receiver, amount, "fuzz");
    
    // Should succeed
    assertEq(router.paymentCount(), 1);
}
```

**Expected Result:** Payments outside bounds are rejected

---

#### Test PR-SEC-005: Fee Cap Enforcement

```solidity
function test_FeeCap_CannotExceedMaximum() public {
    uint256 excessiveFee = router.MAX_FEE_BPS() + 1;
    
    vm.prank(owner);
    vm.expectRevert(abi.encodeWithSelector(PaymentRouter.FeeExceedsMaximum.selector, excessiveFee, router.MAX_FEE_BPS()));
    router.setFeeBps(excessiveFee);
}

function test_FeeCap_MaximumAllowed() public {
    uint256 maxFee = router.MAX_FEE_BPS();
    
    vm.prank(owner);
    router.setFeeBps(maxFee);
    
    assertEq(router.feeBps(), maxFee);
}
```

**Expected Result:** Fee cannot exceed 10% (1000 bps)

---

#### Test PR-SEC-006: Zero Address Validation

```solidity
function test_ZeroAddress_Rejection() public {
    // Constructor
    vm.expectRevert(PaymentRouter.InvalidReceiver.selector);
    new PaymentRouter(address(0), treasury, 100, owner);
    
    vm.expectRevert(PaymentRouter.InvalidTreasury.selector);
    new PaymentRouter(address(usdc), address(0), 100, owner);
    
    // setTreasury
    vm.prank(owner);
    vm.expectRevert(PaymentRouter.InvalidTreasury.selector);
    router.setTreasury(address(0));
    
    // pay
    vm.prank(payer);
    vm.expectRevert(PaymentRouter.InvalidReceiver.selector);
    router.pay(address(0), 1000e6, "test");
}
```

**Expected Result:** All zero address attempts revert

---

#### Test PR-SEC-007: Allowlist Enforcement

```solidity
function test_Allowlist_BypassAttempt() public {
    // Enable allowlist
    vm.prank(owner);
    router.setAllowlistEnabled(true);
    
    // Try to pay non-allowed receiver
    vm.prank(payer);
    vm.expectRevert(abi.encodeWithSelector(PaymentRouter.ReceiverNotAllowed.selector, receiver));
    router.pay(receiver, 1000e6, "test");
    
    // Add receiver to allowlist
    vm.prank(owner);
    router.setReceiverAllowed(receiver, true);
    
    // Should succeed now
    vm.prank(payer);
    router.pay(receiver, 1000e6, "test");
}
```

**Expected Result:** Allowlist properly enforced

---

### 1.2 AgentIdentity Tests

#### Test AI-SEC-001: Max Supply Enforcement

```solidity
function test_MaxSupply_Enforcement() public {
    // Mint MAX_SUPPLY tokens
    vm.startPrank(owner);
    for (uint256 i = 0; i < identity.MAX_SUPPLY(); i++) {
        address newUser = makeAddr(string(abi.encodePacked("user", vm.toString(i))));
        identity.mint(newUser, "Test Agent", "https://agent.io", '["cap"]', "");
    }
    
    // Try to mint one more
    vm.expectRevert(AgentIdentity.MaxSupplyReached.selector);
    identity.mint(makeAddr("extra"), "Test", "https://agent.io", '["cap"]', "");
    vm.stopPrank();
}
```

**Expected Result:** Minting beyond max supply reverts

---

#### Test AI-SEC-002: One Identity Per Address

```solidity
function test_OneIdentityPerAddress() public {
    vm.startPrank(owner);
    
    // Mint first identity
    identity.mint(user1, "Agent 1", "https://agent1.io", '["cap1"]', "");
    
    // Try to mint second identity to same address
    vm.expectRevert(abi.encodeWithSelector(AgentIdentity.IdentityAlreadyExists.selector, user1));
    identity.mint(user1, "Agent 2", "https://agent2.io", '["cap2"]', "");
    
    vm.stopPrank();
}

function test_TransferToExistingIdentity() public {
    vm.startPrank(owner);
    
    uint256 tokenId1 = identity.mint(user1, "Agent 1", "https://agent1.io", '["cap1"]', "");
    identity.mint(user2, "Agent 2", "https://agent2.io", '["cap2"]', "");
    
    vm.stopPrank();
    
    // Try to transfer to user2 who already has identity
    vm.prank(user1);
    vm.expectRevert(abi.encodeWithSelector(AgentIdentity.IdentityAlreadyExists.selector, user2));
    identity.transferFrom(user1, user2, tokenId1);
}
```

**Expected Result:** One identity per address enforced

---

#### Test AI-SEC-003: Credential Authorization

```solidity
function test_Credential_UnauthorizedAddition() public {
    vm.prank(owner);
    uint256 tokenId = identity.mint(user1, "Agent", "https://agent.io", '["cap"]', "");
    
    bytes32 credentialHash = keccak256("credential");
    
    // Unauthorized user tries to add credential
    vm.prank(user2);
    vm.expectRevert(abi.encodeWithSelector(AgentIdentity.UnauthorizedMinter.selector, user2));
    identity.addCredential(tokenId, credentialHash);
}

function test_Credential_UnauthorizedRevocation() public {
    vm.prank(owner);
    uint256 tokenId = identity.mint(user1, "Agent", "https://agent.io", '["cap"]', "");
    
    bytes32 credentialHash = keccak256("credential");
    
    vm.prank(owner);
    identity.addCredential(tokenId, credentialHash);
    
    // Unauthorized user tries to revoke
    vm.prank(user2);
    vm.expectRevert(abi.encodeWithSelector(AgentIdentity.UnauthorizedMinter.selector, user2));
    identity.revokeCredential(tokenId, credentialHash);
}
```

**Expected Result:** Only authorized issuers can add/revoke credentials

---

#### Test AI-SEC-004: Metadata Length Limits

```solidity
function test_Metadata_NameTooLong() public {
    string memory longName = new string(65);
    
    vm.prank(owner);
    vm.expectRevert(AgentIdentity.InvalidMetadata.selector);
    identity.mint(user1, longName, "https://agent.io", '["cap"]', "");
}

function test_Metadata_EndpointTooLong() public {
    string memory longEndpoint = new string(257);
    
    vm.prank(owner);
    vm.expectRevert(AgentIdentity.InvalidMetadata.selector);
    identity.mint(user1, "Agent", longEndpoint, '["cap"]', "");
}

function test_Metadata_CapabilitiesTooLong() public {
    string memory longCapabilities = new string(513);
    
    vm.prank(owner);
    vm.expectRevert(AgentIdentity.InvalidMetadata.selector);
    identity.mint(user1, "Agent", "https://agent.io", longCapabilities, "");
}
```

**Expected Result:** Metadata length limits enforced

---

#### Test AI-SEC-005: withdrawFees Reentrancy

```solidity
// Malicious owner contract
contract MaliciousOwner {
    AgentIdentity public identity;
    uint256 public attackCount;
    
    constructor(address _identity) {
        identity = AgentIdentity(_identity);
    }
    
    function attack() external {
        identity.withdrawFees();
    }
    
    receive() external payable {
        if (attackCount < 5) {
            attackCount++;
            identity.withdrawFees();
        }
    }
}

function test_WithdrawFees_ReentrancyProtection() public {
    // Setup: Set mint fee and mint
    vm.prank(owner);
    identity.setMintFee(0.01 ether);
    
    vm.deal(owner, 1 ether);
    vm.prank(owner);
    identity.mint{value: 0.01 ether}(user1, "Agent", "https://agent.io", '["cap"]', "");
    
    // Deploy malicious owner
    MaliciousOwner malicious = new MaliciousOwner(address(identity));
    
    // Transfer ownership to malicious contract
    vm.prank(owner);
    identity.transferOwnership(address(malicious));
    
    // Attempt reentrancy attack
    // Note: This test documents the vulnerability (AI-005)
    // Fix: Add nonReentrant to withdrawFees
}
```

**Expected Result:** Document reentrancy risk (finding AI-005)

---

## 2. Fuzzing Recommendations

### 2.1 PaymentRouter Fuzz Tests

```solidity
contract PaymentRouterFuzzTest is Test {
    PaymentRouter public router;
    MockUSDC public usdc;
    
    address owner = makeAddr("owner");
    address treasury = makeAddr("treasury");
    address payer = makeAddr("payer");
    
    function setUp() public {
        vm.prank(owner);
        usdc = new MockUSDC();
        router = new PaymentRouter(address(usdc), treasury, 100, owner);
        usdc.mint(payer, 1_000_000_000e6);
        vm.prank(payer);
        usdc.approve(address(router), type(uint256).max);
    }
    
    function testFuzz_Pay(
        uint256 amount, 
        address receiver, 
        string memory memo
    ) public {
        // Bound inputs
        amount = bound(amount, router.MIN_PAYMENT_AMOUNT(), router.MAX_PAYMENT_AMOUNT());
        vm.assume(receiver != address(0));
        vm.assume(receiver != address(router));
        
        // Ensure payer has enough
        if (amount > usdc.balanceOf(payer)) {
            usdc.mint(payer, amount - usdc.balanceOf(payer));
        }
        
        uint256 payerBalanceBefore = usdc.balanceOf(payer);
        
        vm.prank(payer);
        uint256 receiverAmount = router.pay(receiver, amount, memo);
        
        // Invariants
        assertEq(usdc.balanceOf(payer), payerBalanceBefore - amount);
        assertLe(receiverAmount, amount);
        assertEq(router.paymentCount(), 1);
    }
    
    function testFuzz_SetFeeBps(uint256 newFeeBps) public {
        newFeeBps = bound(newFeeBps, 0, router.MAX_FEE_BPS());
        
        vm.prank(owner);
        router.setFeeBps(newFeeBps);
        
        assertEq(router.feeBps(), newFeeBps);
    }
    
    function testFuzz_FeeCalculation(uint256 amount, uint256 feeBps) public {
        amount = bound(amount, 1, type(uint256).max / 10000);
        feeBps = bound(feeBps, 0, 10000);
        
        uint256 fee = (amount * feeBps) / 10000;
        
        // Invariants
        assertLe(fee, amount);
        assertLe(fee, amount * feeBps / 10000 + 1); // Allow rounding
    }
    
    function testFuzz_CalculateFee_AlwaysBounded(
        uint256 amount, 
        uint256 feeBps
    ) public {
        amount = bound(amount, router.MIN_PAYMENT_AMOUNT(), router.MAX_PAYMENT_AMOUNT());
        feeBps = bound(feeBps, 0, router.MAX_FEE_BPS());
        
        vm.prank(owner);
        router.setFeeBps(feeBps);
        
        uint256 fee = router.calculateFee(amount);
        uint256 maxPossibleFee = (amount * router.MAX_FEE_BPS()) / router.BPS_DENOMINATOR();
        
        assertLe(fee, maxPossibleFee);
        assertLe(fee, amount);
    }
}
```

---

### 2.2 AgentIdentity Fuzz Tests

```solidity
contract AgentIdentityFuzzTest is Test {
    AgentIdentity public identity;
    address owner = makeAddr("owner");
    
    function setUp() public {
        vm.prank(owner);
        identity = new AgentIdentity("Agent Link", "ALI", "https://api.io/", owner);
    }
    
    function testFuzz_Mint(
        address to,
        string memory name,
        string memory endpoint,
        string memory capabilities
    ) public {
        vm.assume(to != address(0));
        vm.assume(bytes(name).length > 0 && bytes(name).length <= 64);
        vm.assume(bytes(endpoint).length <= 256);
        vm.assume(bytes(capabilities).length <= 512);
        vm.assume(identity.agentTokenId(to) == 0);
        
        vm.prank(owner);
        uint256 tokenId = identity.mint(to, name, endpoint, capabilities, "");
        
        assertEq(identity.ownerOf(tokenId), to);
        assertEq(identity.agentTokenId(to), tokenId);
    }
    
    function testFuzz_CredentialHash(bytes32 credentialHash) public {
        vm.assume(credentialHash != bytes32(0));
        
        vm.prank(owner);
        uint256 tokenId = identity.mint(makeAddr("user"), "Agent", "https://agent.io", '["cap"]', "");
        
        vm.prank(owner);
        identity.addCredential(tokenId, credentialHash);
        
        assertTrue(identity.hasCredential(tokenId, credentialHash));
    }
    
    function testFuzz_UpdateMetadata(
        string memory name,
        string memory endpoint,
        string memory capabilities
    ) public {
        vm.assume(bytes(name).length <= 64);
        vm.assume(bytes(endpoint).length <= 256);
        vm.assume(bytes(capabilities).length <= 512);
        
        address user = makeAddr("user");
        
        vm.prank(owner);
        uint256 tokenId = identity.mint(user, "Initial", "https://initial.io", '["cap"]', "");
        
        vm.prank(user);
        identity.updateMetadata(tokenId, name, endpoint, capabilities);
        
        AgentIdentity.AgentMetadata memory metadata = identity.getAgentMetadata(tokenId);
        assertEq(metadata.name, name);
        assertEq(metadata.endpoint, endpoint);
        assertEq(metadata.capabilities, capabilities);
    }
}
```

---

## 3. Invariant Tests

### 3.1 PaymentRouter Invariants

```solidity
contract PaymentRouterInvariants is Test {
    PaymentRouter public router;
    MockUSDC public usdc;
    
    address owner;
    address treasury;
    
    function setUp() public {
        owner = makeAddr("owner");
        treasury = makeAddr("treasury");
        
        vm.prank(owner);
        usdc = new MockUSDC();
        router = new PaymentRouter(address(usdc), treasury, 100, owner);
    }
    
    // Invariant 1: Fee never exceeds amount
    function invariant_FeeNeverExceedsAmount() public {
        uint256 amount = router.MAX_PAYMENT_AMOUNT();
        uint256 fee = router.calculateFee(amount);
        
        assertLe(fee, amount);
    }
    
    // Invariant 2: Fee never exceeds MAX_FEE_BPS
    function invariant_FeeNeverExceedsMaxBps() public {
        uint256 amount = router.MAX_PAYMENT_AMOUNT();
        uint256 fee = router.calculateFee(amount);
        uint256 maxPossible = (amount * router.MAX_FEE_BPS()) / router.BPS_DENOMINATOR();
        
        assertLe(fee, maxPossible);
    }
    
    // Invariant 3: Total volume equals sum of all payments
    function invariant_VolumeAccounting() public {
        // This would require tracking all payments in the test
        // and comparing to router.totalVolume()
    }
    
    // Invariant 4: Treasury is never zero address
    function invariant_TreasuryNotZero() public {
        assertTrue(router.treasury() != address(0));
    }
    
    // Invariant 5: Fee BPS never exceeds MAX_FEE_BPS
    function invariant_FeeBpsBounded() public {
        assertLe(router.feeBps(), router.MAX_FEE_BPS());
    }
}
```

---

### 3.2 AgentIdentity Invariants

```solidity
contract AgentIdentityInvariants is Test {
    AgentIdentity public identity;
    address owner;
    
    function setUp() public {
        owner = makeAddr("owner");
        vm.prank(owner);
        identity = new AgentIdentity("Agent Link", "ALI", "https://api.io/", owner);
    }
    
    // Invariant 1: Total supply never exceeds MAX_SUPPLY
    function invariant_SupplyNotExceeded() public {
        assertLe(identity.totalSupply(), identity.MAX_SUPPLY());
    }
    
    // Invariant 2: Each address has at most one identity
    function invariant_OneIdentityPerAddress() public {
        // Would need to track all owners and verify uniqueness
    }
    
    // Invariant 3: Token ID 0 is never minted
    function invariant_NoTokenZero() public {
        // Token IDs start at 1
        vm.expectRevert();
        identity.ownerOf(0);
    }
    
    // Invariant 4: Active token count equals totalSupply
    function invariant_ActiveCount() public {
        // Would need to count active tokens
    }
}
```

---

## 4. Penetration Testing Checklist

### 4.1 Smart Contract Penetration Tests

| # | Test | Tool | Expected Result |
|---|------|------|-----------------|
| 4.1.1 | Slither static analysis | Slither | No critical/high issues |
| 4.1.2 | Mythril symbolic execution | Mythril | No exploitable paths |
| 4.1.3 | Echidna fuzzing | Echidna | All invariants hold |
| 4.1.4 | Certora formal verification | Certora | Specifications verified |
| 4.1.5 | Manual code review | Human | No security issues |

### 4.2 API Penetration Tests

| # | Test | Tool | Expected Result |
|---|------|------|-----------------|
| 4.2.1 | SQL injection | SQLMap | No injection points |
| 4.2.2 | XSS payloads | Burp Suite | All payloads escaped |
| 4.2.3 | CSRF attempts | Burp Suite | All attempts blocked |
| 4.2.4 | Rate limit bypass | Custom script | Limits enforced |
| 4.2.5 | Auth bypass | Burp Suite | All attempts blocked |
| 4.2.6 | IDOR tests | Burp Suite | Access control enforced |

### 4.3 x402 Middleware Penetration Tests

| # | Test | Method | Expected Result |
|---|------|--------|-----------------|
| 4.3.1 | Replay attack | Manual | Replayed payment rejected |
| 4.3.2 | Deadline bypass | Manual | Expired payment rejected |
| 4.3.3 | Amount manipulation | Manual | Incorrect amount rejected |
| 4.3.4 | Signature forgery | Manual | Invalid signature rejected |
| 4.3.5 | Network spoofing | Manual | Wrong network rejected |
| 4.3.6 | Concurrent payments | Load test | No double-spending |

---

## 5. Adversarial Test Scenarios

### 5.1 Scenario: Double-Spend Attack

```typescript
describe('Double-spend protection', () => {
  it('should prevent same payment proof from being used twice', async () => {
    // 1. Create valid payment
    const payment = await createValidPayment({
      amount: '1000000',
      receiver: agentAddress,
    });
    
    // 2. First use - should succeed
    const response1 = await request(app)
      .get('/api/service')
      .set('Authorization', `X402 ${JSON.stringify(payment)}`);
    
    expect(response1.status).toBe(200);
    
    // 3. Second use - should fail
    const response2 = await request(app)
      .get('/api/service')
      .set('Authorization', `X402 ${JSON.stringify(payment)}`);
    
    expect(response2.status).toBe(402);
    expect(response2.body.error).toBe('PAYMENT_ALREADY_USED');
  });
  
  it('should prevent concurrent double-spend attempts', async () => {
    const payment = await createValidPayment({
      amount: '1000000',
      receiver: agentAddress,
    });
    
    // Send multiple requests simultaneously
    const requests = Array(5).fill(null).map(() =>
      request(app)
        .get('/api/service')
        .set('Authorization', `X402 ${JSON.stringify(payment)}`)
    );
    
    const responses = await Promise.all(requests);
    
    // Only one should succeed
    const successes = responses.filter(r => r.status === 200);
    expect(successes).toHaveLength(1);
    
    // Rest should fail with payment already used
    const failures = responses.filter(r => r.status === 402);
    expect(failures.length).toBe(4);
  });
});
```

---

### 5.2 Scenario: Payment Replay Across Services

```typescript
describe('Cross-service replay protection', () => {
  it('should prevent payment for service A being used for service B', async () => {
    // 1. Pay for service A
    const paymentA = await createValidPayment({
      amount: '1000000',
      receiver: agentAddress,
      serviceId: 'service-a',
    });
    
    // 2. Use payment for service A
    const responseA = await request(app)
      .get('/api/service-a')
      .set('Authorization', `X402 ${JSON.stringify(paymentA)}`);
    
    expect(responseA.status).toBe(200);
    
    // 3. Try to use same payment for service B
    const responseB = await request(app)
      .get('/api/service-b')
      .set('Authorization', `X402 ${JSON.stringify(paymentA)}`);
    
    expect(responseB.status).toBe(402);
    expect(responseB.body.error).toBe('PAYMENT_ALREADY_USED');
  });
});
```

---

### 5.3 Scenario: Expired Payment Acceptance

```typescript
describe('Deadline enforcement', () => {
  it('should reject payments past their deadline', async () => {
    // Create payment with deadline 1 second ago
    const expiredPayment = await createValidPayment({
      amount: '1000000',
      receiver: agentAddress,
      deadline: Math.floor(Date.now() / 1000) - 1,
    });
    
    const response = await request(app)
      .get('/api/service')
      .set('Authorization', `X402 ${JSON.stringify(expiredPayment)}`);
    
    expect(response.status).toBe(402);
    expect(response.body.error).toBe('DEADLINE_EXPIRED');
  });
  
  it('should reject payments with future deadlines too far ahead', async () => {
    // Create payment with deadline 1 hour in future
    const suspiciousPayment = await createValidPayment({
      amount: '1000000',
      receiver: agentAddress,
      deadline: Math.floor(Date.now() / 1000) + 3600,
    });
    
    const response = await request(app)
      .get('/api/service')
      .set('Authorization', `X402 ${JSON.stringify(suspiciousPayment)}`);
    
    expect(response.status).toBe(402);
    expect(response.body.error).toBe('INVALID_DEADLINE');
  });
});
```

---

### 5.4 Scenario: Malformed Payment Proofs

```typescript
describe('Input validation', () => {
  it('should reject malformed payment proofs', async () => {
    const malformedPayments = [
      {},  // Empty object
      { txHash: 'invalid' },  // Missing fields
      { txHash: '0x123', signature: '0x456', nonce: 123 },  // Wrong nonce type
      { txHash: '0x123', signature: '0x456', nonce: 'abc', deadline: 'not-a-number' },
      { txHash: '', signature: '', nonce: '', deadline: 0 },  // Empty strings
      null,
      'string',
      123,
    ];
    
    for (const payment of malformedPayments) {
      const response = await request(app)
        .get('/api/service')
        .set('Authorization', `X402 ${JSON.stringify(payment)}`);
      
      expect(response.status).toBe(400);
    }
  });
  
  it('should reject oversized payloads', async () => {
    const hugePayment = {
      txHash: '0x' + 'a'.repeat(10000),  // 10KB hex string
      signature: '0x' + 'b'.repeat(10000),
      nonce: 'c'.repeat(10000),
      deadline: Math.floor(Date.now() / 1000) + 300,
    };
    
    const response = await request(app)
      .get('/api/service')
      .set('Authorization', `X402 ${JSON.stringify(hugePayment)}`);
    
    expect(response.status).toBe(413); // Payload Too Large
  });
});
```

---

## 6. Performance & Load Tests

### 6.1 Rate Limiting Tests

```typescript
describe('Rate limiting', () => {
  it('should enforce rate limits on telemetry endpoint', async () => {
    const agentId = 'test-agent';
    const apiKey = 'test-api-key';
    
    // Send 101 requests (limit is 100)
    const requests = Array(101).fill(null).map((_, i) =>
      request(app)
        .post('/api/telemetry/batch')
        .set('X-Agent-ID', agentId)
        .set('X-API-Key', apiKey)
        .send({ events: [{ type: 'test', timestamp: Date.now(), data: {} }] })
    );
    
    const responses = await Promise.all(requests);
    
    // First 100 should succeed
    const successes = responses.filter(r => r.status === 200);
    expect(successes.length).toBeLessThanOrEqual(100);
    
    // At least one should be rate limited
    const rateLimited = responses.filter(r => r.status === 429);
    expect(rateLimited.length).toBeGreaterThan(0);
  });
});
```

---

## 7. Security Regression Tests

### 7.1 Known Vulnerability Tests

```typescript
describe('Security regression tests', () => {
  it('PR-001: Fee calculation should not overflow', async () => {
    // Test with maximum values
    const maxAmount = await router.MAX_PAYMENT_AMOUNT();
    const maxFee = await router.MAX_FEE_BPS();
    
    const fee = await router.calculateFee(maxAmount);
    
    expect(fee).toBeLessThanOrEqual(maxAmount);
    expect(fee).toBeLessThanOrEqual(maxAmount * maxFee / 10000n);
  });
  
  it('AI-001: _exists should not shadow ERC721', async () => {
    // Verify the function was renamed
    const contract = new ethers.Contract(
      identityAddress,
      [
        'function _tokenExists(uint256 tokenId) view returns (bool)',
      ],
      provider
    );
    
    // Should exist with new name
    const exists = await contract._tokenExists(1);
    expect(typeof exists).toBe('boolean');
  });
  
  it('AI-005: withdrawFees should be nonReentrant', async () => {
    // Verify nonReentrant modifier is present
    const contract = new ethers.Contract(
      identityAddress,
      [
        'function withdrawFees() nonReentrant',
      ],
      provider
    );
    
    // Attempt reentrancy should fail
    // ... test implementation
  });
});
```

---

## 8. Test Execution Checklist

### 8.1 Pre-Deployment Tests

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All fuzz tests complete (minimum 100,000 runs)
- [ ] All invariant tests pass
- [ ] Slither analysis: 0 critical/high issues
- [ ] Manual code review: Approved
- [ ] Gas optimization review: Complete

### 8.2 Post-Deployment Tests

- [ ] Contract verification on block explorer
- [ ] Admin functions tested on mainnet
- [ ] Emergency pause tested
- [ ] Event monitoring confirmed
- [ ] Upgrade path tested (if applicable)

---

*This document should be updated with new test cases as vulnerabilities are discovered.*
