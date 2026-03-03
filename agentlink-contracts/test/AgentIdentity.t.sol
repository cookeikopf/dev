// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Test} from "forge-std/Test.sol";
import {AgentIdentity} from "../src/AgentIdentity.sol";

/**
 * @title AgentIdentityTest
 * @notice Comprehensive test suite for AgentIdentity
 */
contract AgentIdentityTest is Test {
    AgentIdentity public identity;

    address public owner;
    address public minter;
    address public user1;
    address public user2;
    address public operator;

    string public constant NAME = "AgentLink Identity";
    string public constant SYMBOL = "ALI";
    string public constant BASE_URI = "https://api.agentlink.io/metadata/";

    // Events for testing
    event IdentityMinted(uint256 indexed tokenId, address indexed owner, string name);
    event MetadataUpdated(uint256 indexed tokenId, string name, string endpoint, string capabilities);
    event AgentStatusChanged(uint256 indexed tokenId, bool active);
    event CredentialAdded(uint256 indexed tokenId, bytes32 indexed credentialHash, address indexed issuer);
    event CredentialRevoked(uint256 indexed tokenId, bytes32 indexed credentialHash);
    event MinterAuthorized(address indexed minter, bool authorized);
    event PublicMintingToggled(bool enabled);
    event MintFeeUpdated(uint256 oldFee, uint256 newFee);

    function setUp() public {
        owner = makeAddr("owner");
        minter = makeAddr("minter");
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        operator = makeAddr("operator");

        vm.prank(owner);
        identity = new AgentIdentity(NAME, SYMBOL, BASE_URI, owner);
    }

    /*//////////////////////////////////////////////////////////////
                            CONSTRUCTOR TESTS
    //////////////////////////////////////////////////////////////*/

    function test_Constructor_SetsCorrectValues() public view {
        assertEq(identity.name(), NAME);
        assertEq(identity.symbol(), SYMBOL);
        assertEq(identity.owner(), owner);
        assertEq(identity.MAX_SUPPLY(), 100_000);
        assertEq(identity.publicMintingEnabled(), false);
        assertEq(identity.mintFee(), 0);
    }

    /*//////////////////////////////////////////////////////////////
                            MINTING TESTS
    //////////////////////////////////////////////////////////////*/

    function test_Mint_AsOwner() public {
        vm.prank(owner);
        uint256 tokenId = identity.mint(user1, "Test Agent", "https://agent1.agentlink.io", '["cap1"]', "");

        assertEq(tokenId, 1);
        assertEq(identity.ownerOf(tokenId), user1);
        assertEq(identity.agentTokenId(user1), tokenId);
    }

    function test_Mint_EmitsIdentityMintedEvent() public {
        vm.prank(owner);
        vm.expectEmit(true, true, false, true);
        emit IdentityMinted(1, user1, "Test Agent");
        identity.mint(user1, "Test Agent", "https://agent1.agentlink.io", '["cap1"]', "");
    }

    function test_Mint_SetsCorrectMetadata() public {
        vm.prank(owner);
        uint256 tokenId = identity.mint(user1, "Test Agent", "https://agent1.agentlink.io", '["cap1", "cap2"]', "");

        AgentIdentity.AgentMetadata memory metadata = identity.getAgentMetadata(tokenId);
        assertEq(metadata.name, "Test Agent");
        assertEq(metadata.endpoint, "https://agent1.agentlink.io");
        assertEq(metadata.capabilities, '["cap1", "cap2"]');
        assertEq(metadata.active, true);
        assertGt(metadata.createdAt, 0);
    }

    function test_Mint_AsAuthorizedMinter() public {
        vm.prank(owner);
        identity.setAuthorizedMinter(minter, true);

        vm.prank(minter);
        uint256 tokenId = identity.mint(user1, "Test Agent", "https://agent1.agentlink.io", '["cap1"]', "");

        assertEq(tokenId, 1);
    }

    function test_Mint_RevertsWhenNotAuthorized() public {
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(AgentIdentity.UnauthorizedMinter.selector, user1));
        identity.mint(user1, "Test Agent", "https://agent1.agentlink.io", '["cap1"]', "");
    }

    function test_Mint_RevertsOnDuplicateIdentity() public {
        vm.startPrank(owner);
        identity.mint(user1, "Test Agent", "https://agent1.agentlink.io", '["cap1"]', "");

        vm.expectRevert(abi.encodeWithSelector(AgentIdentity.IdentityAlreadyExists.selector, user1));
        identity.mint(user1, "Test Agent 2", "https://agent2.agentlink.io", '["cap2"]', "");
        vm.stopPrank();
    }

    function test_Mint_RevertsOnEmptyName() public {
        vm.prank(owner);
        vm.expectRevert(AgentIdentity.InvalidMetadata.selector);
        identity.mint(user1, "", "https://agent1.agentlink.io", '["cap1"]', "");
    }

    function test_Mint_RevertsOnNameTooLong() public {
        string memory longName = new string(65);
        for (uint256 i = 0; i < 65; i++) {
            longName = string(abi.encodePacked(longName, "a"));
        }

        vm.prank(owner);
        vm.expectRevert(AgentIdentity.InvalidMetadata.selector);
        identity.mint(user1, longName, "https://agent1.agentlink.io", '["cap1"]', "");
    }

    function test_Mint_RevertsOnZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(AgentIdentity.InvalidMetadata.selector);
        identity.mint(address(0), "Test Agent", "https://agent1.agentlink.io", '["cap1"]', "");
    }

    function test_Mint_RevertsWhenMaxSupplyReached() public {
        // Mint MAX_SUPPLY tokens
        vm.startPrank(owner);
        for (uint256 i = 0; i < identity.MAX_SUPPLY(); i++) {
            address newUser = makeAddr(string(abi.encodePacked("user", vm.toString(i))));
            identity.mint(newUser, "Test Agent", "https://agent1.agentlink.io", '["cap1"]', "");
        }

        vm.expectRevert(AgentIdentity.MaxSupplyReached.selector);
        identity.mint(user1, "Test Agent", "https://agent1.agentlink.io", '["cap1"]', "");
        vm.stopPrank();
    }

    function test_Mint_WithMintFee() public {
        uint256 fee = 0.01 ether;

        vm.prank(owner);
        identity.setMintFee(fee);

        vm.deal(owner, 1 ether);
        vm.prank(owner);
        uint256 tokenId = identity.mint{value: fee}(user1, "Test Agent", "https://agent1.agentlink.io", '["cap1"]', "");

        assertEq(tokenId, 1);
        assertEq(address(identity).balance, fee);
    }

    function test_Mint_RevertsOnInsufficientFee() public {
        uint256 fee = 0.01 ether;

        vm.prank(owner);
        identity.setMintFee(fee);

        vm.deal(owner, 1 ether);
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(AgentIdentity.InsufficientFee.selector, 0.005 ether, fee));
        identity.mint{value: 0.005 ether}(user1, "Test Agent", "https://agent1.agentlink.io", '["cap1"]', "");
    }

    /*//////////////////////////////////////////////////////////////
                        PUBLIC MINTING TESTS
    //////////////////////////////////////////////////////////////*/

    function test_MintSelf_WithPublicMinting() public {
        vm.prank(owner);
        identity.setPublicMintingEnabled(true);

        vm.prank(user1);
        uint256 tokenId = identity.mintSelf("Test Agent", "https://agent1.agentlink.io", '["cap1"]', "");

        assertEq(tokenId, 1);
        assertEq(identity.ownerOf(tokenId), user1);
    }

    function test_MintSelf_RevertsWithoutPublicMinting() public {
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(AgentIdentity.UnauthorizedMinter.selector, user1));
        identity.mintSelf("Test Agent", "https://agent1.agentlink.io", '["cap1"]', "");
    }

    /*//////////////////////////////////////////////////////////////
                        METADATA UPDATE TESTS
    //////////////////////////////////////////////////////////////*/

    function test_UpdateMetadata_AsOwner() public {
        vm.prank(owner);
        uint256 tokenId = identity.mint(user1, "Test Agent", "https://agent1.agentlink.io", '["cap1"]', "");

        vm.prank(user1);
        vm.expectEmit(true, false, false, true);
        emit MetadataUpdated(tokenId, "Updated Agent", "https://updated.agentlink.io", '["newcap"]');
        identity.updateMetadata(tokenId, "Updated Agent", "https://updated.agentlink.io", '["newcap"]');

        AgentIdentity.AgentMetadata memory metadata = identity.getAgentMetadata(tokenId);
        assertEq(metadata.name, "Updated Agent");
        assertEq(metadata.endpoint, "https://updated.agentlink.io");
        assertEq(metadata.capabilities, '["newcap"]');
    }

    function test_UpdateMetadata_RevertsWhenNotOwner() public {
        vm.prank(owner);
        uint256 tokenId = identity.mint(user1, "Test Agent", "https://agent1.agentlink.io", '["cap1"]', "");

        vm.prank(user2);
        vm.expectRevert(abi.encodeWithSelector(AgentIdentity.NotTokenOwner.selector, tokenId, user2));
        identity.updateMetadata(tokenId, "Updated", "https://updated.io", '["cap"]');
    }

    function test_SetActive_AsOwner() public {
        vm.prank(owner);
        uint256 tokenId = identity.mint(user1, "Test Agent", "https://agent1.agentlink.io", '["cap1"]', "");

        vm.prank(user1);
        vm.expectEmit(true, false, false, true);
        emit AgentStatusChanged(tokenId, false);
        identity.setActive(tokenId, false);

        AgentIdentity.AgentMetadata memory metadata = identity.getAgentMetadata(tokenId);
        assertEq(metadata.active, false);
    }

    /*//////////////////////////////////////////////////////////////
                        CREDENTIAL TESTS
    //////////////////////////////////////////////////////////////*/

    function test_AddCredential_AsOwner() public {
        vm.prank(owner);
        uint256 tokenId = identity.mint(user1, "Test Agent", "https://agent1.agentlink.io", '["cap1"]', "");

        bytes32 credentialHash = keccak256("credential1");

        vm.prank(owner);
        vm.expectEmit(true, true, true, false);
        emit CredentialAdded(tokenId, credentialHash, owner);
        identity.addCredential(tokenId, credentialHash);

        assertTrue(identity.hasCredential(tokenId, credentialHash));
    }

    function test_AddCredential_AsAuthorizedMinter() public {
        vm.prank(owner);
        uint256 tokenId = identity.mint(user1, "Test Agent", "https://agent1.agentlink.io", '["cap1"]', "");

        vm.prank(owner);
        identity.setAuthorizedMinter(minter, true);

        bytes32 credentialHash = keccak256("credential1");

        vm.prank(minter);
        identity.addCredential(tokenId, credentialHash);

        assertTrue(identity.hasCredential(tokenId, credentialHash));
    }

    function test_AddCredential_RevertsWhenUnauthorized() public {
        vm.prank(owner);
        uint256 tokenId = identity.mint(user1, "Test Agent", "https://agent1.agentlink.io", '["cap1"]', "");

        bytes32 credentialHash = keccak256("credential1");

        vm.prank(user2);
        vm.expectRevert(abi.encodeWithSelector(AgentIdentity.UnauthorizedMinter.selector, user2));
        identity.addCredential(tokenId, credentialHash);
    }

    function test_AddCredential_RevertsOnDuplicate() public {
        vm.prank(owner);
        uint256 tokenId = identity.mint(user1, "Test Agent", "https://agent1.agentlink.io", '["cap1"]', "");

        bytes32 credentialHash = keccak256("credential1");

        vm.startPrank(owner);
        identity.addCredential(tokenId, credentialHash);

        vm.expectRevert(abi.encodeWithSelector(AgentIdentity.CredentialAlreadyExists.selector, credentialHash));
        identity.addCredential(tokenId, credentialHash);
        vm.stopPrank();
    }

    function test_RevokeCredential_AsIssuer() public {
        vm.prank(owner);
        uint256 tokenId = identity.mint(user1, "Test Agent", "https://agent1.agentlink.io", '["cap1"]', "");

        bytes32 credentialHash = keccak256("credential1");

        vm.prank(owner);
        identity.addCredential(tokenId, credentialHash);

        vm.prank(owner);
        vm.expectEmit(true, true, false, false);
        emit CredentialRevoked(tokenId, credentialHash);
        identity.revokeCredential(tokenId, credentialHash);

        assertFalse(identity.hasCredential(tokenId, credentialHash));
    }

    function test_RevokeCredential_AsOwner() public {
        vm.prank(owner);
        identity.setAuthorizedMinter(minter, true);

        vm.prank(owner);
        uint256 tokenId = identity.mint(user1, "Test Agent", "https://agent1.agentlink.io", '["cap1"]', "");

        bytes32 credentialHash = keccak256("credential1");

        vm.prank(minter);
        identity.addCredential(tokenId, credentialHash);

        // Owner can revoke even if not issuer
        vm.prank(owner);
        identity.revokeCredential(tokenId, credentialHash);

        assertFalse(identity.hasCredential(tokenId, credentialHash));
    }

    function test_RevokeCredential_RevertsWhenNotIssuerOrOwner() public {
        vm.prank(owner);
        uint256 tokenId = identity.mint(user1, "Test Agent", "https://agent1.agentlink.io", '["cap1"]', "");

        bytes32 credentialHash = keccak256("credential1");

        vm.prank(owner);
        identity.addCredential(tokenId, credentialHash);

        vm.prank(user2);
        vm.expectRevert(abi.encodeWithSelector(AgentIdentity.UnauthorizedMinter.selector, user2));
        identity.revokeCredential(tokenId, credentialHash);
    }

    function test_GetCredentialDetails_ReturnsCorrectInfo() public {
        vm.prank(owner);
        uint256 tokenId = identity.mint(user1, "Test Agent", "https://agent1.agentlink.io", '["cap1"]', "");

        bytes32 credentialHash = keccak256("credential1");

        vm.prank(owner);
        identity.addCredential(tokenId, credentialHash);

        (address issuer, uint256 timestamp) = identity.getCredentialDetails(tokenId, credentialHash);
        assertEq(issuer, owner);
        assertGt(timestamp, 0);
    }

    /*//////////////////////////////////////////////////////////////
                        ERC-8004 COMPATIBILITY TESTS
    //////////////////////////////////////////////////////////////*/

    function test_DidDocumentURI_ReturnsCorrectURI() public {
        vm.prank(owner);
        uint256 tokenId = identity.mint(user1, "Test Agent", "https://agent1.agentlink.io", '["cap1"]', "");

        string memory didURI = identity.didDocumentURI(tokenId);
        assertEq(didURI, string(abi.encodePacked(BASE_URI, "did/", vm.toString(tokenId))));
    }

    function test_VerifyCredential_ReturnsCorrectStatus() public {
        vm.prank(owner);
        uint256 tokenId = identity.mint(user1, "Test Agent", "https://agent1.agentlink.io", '["cap1"]', "");

        bytes32 credentialHash = keccak256("credential1");

        assertFalse(identity.verifyCredential(tokenId, credentialHash));

        vm.prank(owner);
        identity.addCredential(tokenId, credentialHash);

        assertTrue(identity.verifyCredential(tokenId, credentialHash));
    }

    function test_ServiceEndpoint_ReturnsCorrectEndpoint() public {
        vm.prank(owner);
        uint256 tokenId = identity.mint(user1, "Test Agent", "https://agent1.agentlink.io", '["cap1"]', "");

        string memory endpoint = identity.serviceEndpoint(tokenId);
        assertEq(endpoint, "https://agent1.agentlink.io");
    }

    /*//////////////////////////////////////////////////////////////
                        ADMIN FUNCTION TESTS
    //////////////////////////////////////////////////////////////*/

    function test_SetAuthorizedMinter_UpdatesMinter() public {
        vm.prank(owner);
        vm.expectEmit(true, false, false, true);
        emit MinterAuthorized(minter, true);
        identity.setAuthorizedMinter(minter, true);

        assertTrue(identity.authorizedMinters(minter));
    }

    function test_SetPublicMintingEnabled_TogglesMinting() public {
        vm.prank(owner);
        vm.expectEmit(false, false, false, true);
        emit PublicMintingToggled(true);
        identity.setPublicMintingEnabled(true);

        assertTrue(identity.publicMintingEnabled());
    }

    function test_SetMintFee_UpdatesFee() public {
        uint256 newFee = 0.05 ether;

        vm.prank(owner);
        vm.expectEmit(true, true, false, false);
        emit MintFeeUpdated(0, newFee);
        identity.setMintFee(newFee);

        assertEq(identity.mintFee(), newFee);
    }

    function test_SetBaseURI_UpdatesBaseURI() public {
        string memory newBaseURI = "https://newapi.agentlink.io/metadata/";

        vm.prank(owner);
        identity.setBaseURI(newBaseURI);

        // Mint a token to test new base URI
        vm.prank(owner);
        uint256 tokenId = identity.mint(user1, "Test Agent", "https://agent1.agentlink.io", '["cap1"]', "");

        string memory didURI = identity.didDocumentURI(tokenId);
        assertEq(didURI, string(abi.encodePacked(newBaseURI, "did/", vm.toString(tokenId))));
    }

    function test_Pause_PausesContract() public {
        vm.prank(owner);
        identity.pause();

        assertTrue(identity.paused());

        vm.prank(owner);
        vm.expectRevert();
        identity.mint(user1, "Test Agent", "https://agent1.agentlink.io", '["cap1"]', "");
    }

    function test_Unpause_UnpausesContract() public {
        vm.startPrank(owner);
        identity.pause();
        identity.unpause();
        vm.stopPrank();

        assertFalse(identity.paused());

        vm.prank(owner);
        identity.mint(user1, "Test Agent", "https://agent1.agentlink.io", '["cap1"]', "");
    }

    function test_WithdrawFees_Works() public {
        uint256 fee = 0.01 ether;

        vm.prank(owner);
        identity.setMintFee(fee);

        vm.deal(owner, 1 ether);
        vm.prank(owner);
        identity.mint{value: fee}(user1, "Test Agent", "https://agent1.agentlink.io", '["cap1"]', "");

        uint256 ownerBalanceBefore = owner.balance;

        vm.prank(owner);
        identity.withdrawFees();

        assertEq(owner.balance, ownerBalanceBefore + fee);
        assertEq(address(identity).balance, 0);
    }

    /*//////////////////////////////////////////////////////////////
                        VIEW FUNCTION TESTS
    //////////////////////////////////////////////////////////////*/

    function test_GetAgentMetadata_ReturnsCorrectData() public {
        vm.prank(owner);
        uint256 tokenId = identity.mint(user1, "Test Agent", "https://agent1.agentlink.io", '["cap1"]', "");

        AgentIdentity.AgentMetadata memory metadata = identity.getAgentMetadata(tokenId);
        assertEq(metadata.name, "Test Agent");
        assertEq(metadata.endpoint, "https://agent1.agentlink.io");
        assertEq(metadata.capabilities, '["cap1"]');
        assertEq(metadata.active, true);
    }

    function test_GetTokenIdByOwner_ReturnsCorrectId() public {
        vm.prank(owner);
        uint256 tokenId = identity.mint(user1, "Test Agent", "https://agent1.agentlink.io", '["cap1"]', "");

        assertEq(identity.getTokenIdByOwner(user1), tokenId);
    }

    function test_HasIdentity_ReturnsCorrectStatus() public {
        assertFalse(identity.hasIdentity(user1));

        vm.prank(owner);
        identity.mint(user1, "Test Agent", "https://agent1.agentlink.io", '["cap1"]', "");

        assertTrue(identity.hasIdentity(user1));
    }

    function test_TotalSupply_ReturnsCorrectCount() public {
        assertEq(identity.totalSupply(), 0);

        vm.prank(owner);
        identity.mint(user1, "Test Agent", "https://agent1.agentlink.io", '["cap1"]', "");

        assertEq(identity.totalSupply(), 1);
    }

    /*//////////////////////////////////////////////////////////////
                        TRANSFER TESTS
    //////////////////////////////////////////////////////////////*/

    function test_Transfer_UpdatesAgentTokenId() public {
        vm.prank(owner);
        uint256 tokenId = identity.mint(user1, "Test Agent", "https://agent1.agentlink.io", '["cap1"]', "");

        assertEq(identity.agentTokenId(user1), tokenId);
        assertEq(identity.agentTokenId(user2), 0);

        vm.prank(user1);
        identity.transferFrom(user1, user2, tokenId);

        assertEq(identity.agentTokenId(user1), 0);
        assertEq(identity.agentTokenId(user2), tokenId);
    }

    function test_Transfer_RevertsIfRecipientHasIdentity() public {
        vm.startPrank(owner);
        uint256 tokenId1 = identity.mint(user1, "Test Agent 1", "https://agent1.agentlink.io", '["cap1"]', "");
        identity.mint(user2, "Test Agent 2", "https://agent2.agentlink.io", '["cap2"]', "");
        vm.stopPrank();

        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(AgentIdentity.IdentityAlreadyExists.selector, user2));
        identity.transferFrom(user1, user2, tokenId1);
    }

    /*//////////////////////////////////////////////////////////////
                        ACCESS CONTROL TESTS
    //////////////////////////////////////////////////////////////*/

    function test_OnlyOwnerCanSetAuthorizedMinter() public {
        vm.prank(user1);
        vm.expectRevert();
        identity.setAuthorizedMinter(minter, true);
    }

    function test_OnlyOwnerCanSetPublicMinting() public {
        vm.prank(user1);
        vm.expectRevert();
        identity.setPublicMintingEnabled(true);
    }

    function test_OnlyOwnerCanSetMintFee() public {
        vm.prank(user1);
        vm.expectRevert();
        identity.setMintFee(0.01 ether);
    }

    function test_OnlyOwnerCanPause() public {
        vm.prank(user1);
        vm.expectRevert();
        identity.pause();
    }

    function test_OnlyOwnerCanWithdrawFees() public {
        vm.prank(user1);
        vm.expectRevert();
        identity.withdrawFees();
    }

    /*//////////////////////////////////////////////////////////////
                        FUZZ TESTS
    //////////////////////////////////////////////////////////////*/

    function testFuzz_Mint_WithValidName(string memory name) public {
        // Bound name length
        vm.assume(bytes(name).length > 0 && bytes(name).length <= 64);

        vm.prank(owner);
        uint256 tokenId = identity.mint(user1, name, "https://agent1.agentlink.io", '["cap1"]', "");

        AgentIdentity.AgentMetadata memory metadata = identity.getAgentMetadata(tokenId);
        assertEq(metadata.name, name);
    }

    function testFuzz_CredentialHash(bytes32 credentialHash) public {
        vm.assume(credentialHash != bytes32(0));

        vm.prank(owner);
        uint256 tokenId = identity.mint(user1, "Test Agent", "https://agent1.agentlink.io", '["cap1"]', "");

        vm.prank(owner);
        identity.addCredential(tokenId, credentialHash);

        assertTrue(identity.hasCredential(tokenId, credentialHash));
    }
}
