// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {Test} from "forge-std/Test.sol";
import {ClawCreditAgentStandardV3} from "../src/ClawCreditAgentStandardV3.sol";
import {MockAggregator} from "../src/mocks/MockAggregator.sol";
import {MockERC8004Reputation} from "../src/mocks/MockERC8004Reputation.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {MockUnderwriterModel} from "../src/mocks/MockUnderwriterModel.sol";

contract OriginCaller {
    function callVerify(
        ClawCreditAgentStandardV3 pool,
        address subject,
        address verifier,
        bytes32 action,
        uint256 deadline,
        bytes32 payloadHash,
        bytes calldata signature
    ) external {
        pool.verifySocialAccount(subject, verifier, action, deadline, payloadHash, signature);
    }
}

contract ClawCreditAgentStandardV3Test is Test {
    MockUSDC internal usdc;
    MockERC8004Reputation internal reputation;
    MockAggregator internal usdcFeed;
    MockAggregator internal aiFeed;
    MockUnderwriterModel internal model;
    ClawCreditAgentStandardV3 internal pool;

    address internal guardian = address(0x11);
    address internal treasury = address(0x12);
    address internal attestor = address(0x13);
    address internal hook = address(0x14);
    address internal lender = address(0x100);
    address internal agent = address(0x200);
    uint16 internal underwriterId;

    uint256 internal verifierPk = 0xA11CE;
    address internal verifier;

    function _domainSeparator() internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("ClawCreditAgentStandardV3")),
                keccak256(bytes("1")),
                block.chainid,
                address(pool)
            )
        );
    }

    function _socialDigest(
        address subject,
        address _verifier,
        bytes32 action,
        uint256 nonce,
        uint256 deadline,
        bytes32 payloadHash
    ) internal view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256("SocialVerification(address subject,address verifier,bytes32 action,uint256 chainId,address contractAddress,uint256 nonce,uint256 deadline,bytes32 payloadHash)"),
                subject,
                _verifier,
                action,
                block.chainid,
                address(pool),
                nonce,
                deadline,
                payloadHash
            )
        );
        return keccak256(abi.encodePacked("\x19\x01", _domainSeparator(), structHash));
    }

    function setUp() public {
        usdc = new MockUSDC();
        reputation = new MockERC8004Reputation();
        usdcFeed = new MockAggregator(8, 1e8);
        aiFeed = new MockAggregator(8, 7500e4);
        model = new MockUnderwriterModel();

        pool = new ClawCreditAgentStandardV3(
            address(this),
            guardian,
            treasury,
            address(usdc),
            address(reputation),
            address(usdcFeed),
            address(aiFeed)
        );

        pool.grantRole(pool.ATTESTOR_ROLE(), attestor);
        pool.grantRole(pool.EARNINGS_HOOK_ROLE(), hook);

        underwriterId = pool.registerUnderwriter(address(model), 100);
        verifier = vm.addr(verifierPk);
        pool.grantRole(pool.VERIFIER_ROLE(), verifier);

        reputation.setReputation(agent, 8500, true);

        usdc.mint(lender, 1_000_000e6);
        usdc.mint(agent, 400_000e6);

        vm.startPrank(lender);
        usdc.approve(address(pool), type(uint256).max);
        pool.depositTranche(pool.TRANCHE_SENIOR(), 200_000e6);
        pool.depositTranche(pool.TRANCHE_MEZZ(), 200_000e6);
        pool.depositTranche(pool.TRANCHE_JUNIOR(), 200_000e6);
        vm.stopPrank();

        vm.prank(agent);
        usdc.approve(address(pool), type(uint256).max);
    }

    function test_TaskBackedLoanRequiresEscrow() public {
        vm.prank(agent);
        uint256 taskId = pool.createTaskReceivable(200e6, uint40(block.timestamp + 20 days), keccak256("bad"), false);

        ClawCreditAgentStandardV3.Covenant memory c;
        vm.prank(agent);
        vm.expectRevert(ClawCreditAgentStandardV3.TaskUnavailable.selector);
        pool.openTaskBackedLoan(taskId, 50e6, 10, underwriterId, keccak256("intent"), c);
    }

    function test_VerifySocialAccountRequiresValidEIP712Sig_NoOriginBypass() public {
        bytes32 action = keccak256("social:twitter");
        bytes32 payload = keccak256("@agent");
        uint256 deadline = block.timestamp + 1 days;
        uint256 nonce = pool.verificationNonces(agent, verifier);

        bytes32 digest = _socialDigest(agent, verifier, action, nonce, deadline, payload);
        (uint8 v, bytes32 r, bytes32 sSig) = vm.sign(verifierPk, digest);
        bytes memory sig = abi.encodePacked(r, sSig, v);

        OriginCaller caller = new OriginCaller();
        caller.callVerify(pool, agent, verifier, action, deadline, payload, sig);
        assertTrue(pool.socialVerified(agent));

        vm.expectRevert();
        caller.callVerify(pool, agent, verifier, action, deadline, payload, sig);
    }

    function test_DefaultCloseDoesNotPayReservedCreditToBorrower() public {
        ClawCreditAgentStandardV3.Covenant memory c;
        vm.prank(agent);
        uint256 loanId = pool.openRevolvingLoan(100e6, 2, underwriterId, keccak256("def"), c);

        uint256 beforeBal = usdc.balanceOf(agent);
        vm.warp(block.timestamp + 10 days);
        pool.liquidate(loanId);
        uint256 afterBal = usdc.balanceOf(agent);

        assertEq(afterBal, beforeBal);
    }

    function test_EmergencyRecoverCannotDrainUSDC() public {
        vm.prank(guardian);
        pool.pause();
        vm.expectRevert(ClawCreditAgentStandardV3.DelegationUnavailable.selector);
        pool.emergencyRecoverToken(address(usdc), treasury, 1e6);
    }

    function test_Invariant_TotalOutstandingMatchesActivePrincipal() public {
        ClawCreditAgentStandardV3.Covenant memory c;
        vm.prank(agent);
        uint256 l1 = pool.openRevolvingLoan(100e6, 20, underwriterId, keccak256("a"), c);
        vm.prank(agent);
        uint256 l2 = pool.openRevolvingLoan(60e6, 20, underwriterId, keccak256("b"), c);
        vm.prank(agent);
        pool.cancelUnusedCredit(l1, 30e6);

        _assertOutstandingMatches(agent);

        vm.prank(agent);
        pool.repay(l2, 20e6);
        _assertOutstandingMatches(agent);
    }

    function _assertOutstandingMatches(address borrower) internal {
        uint256 sum;
        uint256[] memory ids = pool.getAgentLoans(borrower);
        for (uint256 i = 0; i < ids.length; i++) {
            ClawCreditAgentStandardV3.Loan memory loan = pool.getLoan(ids[i]);
            if (loan.active) sum += loan.principalOutstanding;
        }
        assertEq(pool.totalOutstandingPrincipal(), sum);
    }
}
