// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/security/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title AgentIdentity
 * @notice ERC-721 identity NFT with ERC-8004 compatibility for AgentLink protocol
 * @dev Minimal identity contract supporting agent metadata and verifiable credentials
 * @custom:security-contact security@agentlink.io
 */
contract AgentIdentity is
    ERC721,
    ERC721Enumerable,
    ERC721URIStorage,
    Ownable2Step,
    Pausable,
    ReentrancyGuard
{
    /*//////////////////////////////////////////////////////////////
                                CONSTANTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Maximum supply of identity NFTs
    uint256 public constant MAX_SUPPLY = 100_000;

    /// @notice Maximum metadata length
    uint256 public constant MAX_NAME_LENGTH = 64;
    uint256 public constant MAX_ENDPOINT_LENGTH = 256;
    uint256 public constant MAX_CAPABILITIES_LENGTH = 512;

    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @notice Current token ID counter
    uint256 private _tokenIdCounter;

    /// @notice Base URI for token metadata
    string private _baseTokenURI;

    /// @notice Agent metadata struct
    struct AgentMetadata {
        string name;           // Agent display name
        string endpoint;       // Agent service endpoint
        string capabilities;   // JSON array of capabilities
        uint256 createdAt;     // Creation timestamp
        bool active;           // Whether agent is active
    }

    /// @notice Mapping from token ID to agent metadata
    mapping(uint256 => AgentMetadata) public agentMetadata;

    /// @notice Mapping from address to their agent token ID (0 if none)
    mapping(address => uint256) public agentTokenId;

    /// @notice Mapping of authorized minters
    mapping(address => bool) public authorizedMinters;

    /// @notice Mapping of verifiable credentials (tokenId => credentialHash => exists)
    mapping(uint256 => mapping(bytes32 => bool)) public credentials;

    /// @notice Mapping of credential issuers (tokenId => credentialHash => issuer)
    mapping(uint256 => mapping(bytes32 => address)) public credentialIssuers;

    /// @notice Mapping of credential timestamps
    mapping(uint256 => mapping(bytes32 => uint256)) public credentialTimestamps;

    /// @notice Whether minting is public or restricted
    bool public publicMintingEnabled;

    /// @notice Mint fee (in wei, if applicable)
    uint256 public mintFee;

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Emitted when a new agent identity is minted
    /// @param tokenId ID of the minted token
    /// @param owner Address of the token owner
    /// @param name Agent name
    event IdentityMinted(
        uint256 indexed tokenId,
        address indexed owner,
        string name
    );

    /// @notice Emitted when agent metadata is updated
    /// @param tokenId ID of the token
    /// @param name Updated name
    /// @param endpoint Updated endpoint
    /// @param capabilities Updated capabilities
    event MetadataUpdated(
        uint256 indexed tokenId,
        string name,
        string endpoint,
        string capabilities
    );

    /// @notice Emitted when agent status is changed
    /// @param tokenId ID of the token
    /// @param active New active status
    event AgentStatusChanged(uint256 indexed tokenId, bool active);

    /// @notice Emitted when a credential is added
    /// @param tokenId ID of the token
    /// @param credentialHash Hash of the credential
    /// @param issuer Address of the credential issuer
    event CredentialAdded(
        uint256 indexed tokenId,
        bytes32 indexed credentialHash,
        address indexed issuer
    );

    /// @notice Emitted when a credential is revoked
    /// @param tokenId ID of the token
    /// @param credentialHash Hash of the credential
    event CredentialRevoked(uint256 indexed tokenId, bytes32 indexed credentialHash);

    /// @notice Emitted when minter authorization is changed
    /// @param minter Address of the minter
    /// @param authorized Whether authorized
    event MinterAuthorized(address indexed minter, bool authorized);

    /// @notice Emitted when public minting is toggled
    /// @param enabled Whether public minting is enabled
    event PublicMintingToggled(bool enabled);

    /// @notice Emitted when mint fee is updated
    /// @param oldFee Previous fee
    /// @param newFee New fee
    event MintFeeUpdated(uint256 oldFee, uint256 newFee);

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/

    /// @notice Thrown when max supply is reached
    error MaxSupplyReached();

    /// @notice Thrown when address already has an identity
    error IdentityAlreadyExists(address owner);

    /// @notice Thrown when token does not exist
    error TokenDoesNotExist(uint256 tokenId);

    /// @notice Thrown when caller is not the token owner
    error NotTokenOwner(uint256 tokenId, address caller);

    /// @notice Thrown when metadata is invalid
    error InvalidMetadata();

    /// @notice Thrown when caller is not authorized to mint
    error UnauthorizedMinter(address caller);

    /// @notice Thrown when credential already exists
    error CredentialAlreadyExists(bytes32 credentialHash);

    /// @notice Thrown when credential does not exist
    error CredentialNotFound(bytes32 credentialHash);

    /// @notice Thrown when fee is insufficient
    error InsufficientFee(uint256 provided, uint256 required);

    /*//////////////////////////////////////////////////////////////
                            MODIFIERS
    //////////////////////////////////////////////////////////////*/

    /// @notice Restricts function to token owner
    modifier onlyTokenOwner(uint256 tokenId) {
        if (ownerOf(tokenId) != msg.sender) {
            revert NotTokenOwner(tokenId, msg.sender);
        }
        _;
    }

    /// @notice Restricts function to authorized minters
    modifier onlyAuthorizedMinter() {
        if (!authorizedMinters[msg.sender] && !publicMintingEnabled && msg.sender != owner()) {
            revert UnauthorizedMinter(msg.sender);
        }
        _;
    }

    /*//////////////////////////////////////////////////////////////
                            CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Initializes the AgentIdentity contract
     * @param _name Token name
     * @param _symbol Token symbol
     * @param _baseURI Base URI for token metadata
     * @param _initialOwner Initial owner address
     */
    constructor(
        string memory _name,
        string memory _symbol,
        string memory _baseURI,
        address _initialOwner
    ) ERC721(_name, _symbol) Ownable(_initialOwner) {
        _baseTokenURI = _baseURI;
        publicMintingEnabled = false;
        mintFee = 0;
    }

    /*//////////////////////////////////////////////////////////////
                        MINTING FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Mints a new agent identity NFT
     * @param to Address to mint to
     * @param name Agent display name
     * @param endpoint Agent service endpoint
     * @param capabilities JSON array of capabilities
     * @param uri Token URI (can be empty string)
     * @return tokenId ID of the minted token
     */
    function mint(
        address to,
        string calldata name,
        string calldata endpoint,
        string calldata capabilities,
        string calldata uri
    ) external payable onlyAuthorizedMinter whenNotPaused nonReentrant returns (uint256 tokenId) {
        // CHECKS
        if (to == address(0)) revert InvalidMetadata();
        if (agentTokenId[to] != 0) revert IdentityAlreadyExists(to);
        if (bytes(name).length == 0 || bytes(name).length > MAX_NAME_LENGTH) revert InvalidMetadata();
        if (bytes(endpoint).length > MAX_ENDPOINT_LENGTH) revert InvalidMetadata();
        if (bytes(capabilities).length > MAX_CAPABILITIES_LENGTH) revert InvalidMetadata();
        if (_tokenIdCounter >= MAX_SUPPLY) revert MaxSupplyReached();
        if (msg.value < mintFee) revert InsufficientFee(msg.value, mintFee);

        // EFFECTS
        tokenId = ++_tokenIdCounter;
        agentTokenId[to] = tokenId;

        agentMetadata[tokenId] = AgentMetadata({
            name: name,
            endpoint: endpoint,
            capabilities: capabilities,
            createdAt: block.timestamp,
            active: true
        });

        // INTERACTIONS
        _safeMint(to, tokenId);

        if (bytes(uri).length > 0) {
            _setTokenURI(tokenId, uri);
        }

        emit IdentityMinted(tokenId, to, name);

        return tokenId;
    }

    /**
     * @notice Mints a new identity to the caller
     * @param name Agent display name
     * @param endpoint Agent service endpoint
     * @param capabilities JSON array of capabilities
     * @param uri Token URI
     * @return tokenId ID of the minted token
     */
    function mintSelf(
        string calldata name,
        string calldata endpoint,
        string calldata capabilities,
        string calldata uri
    ) external payable whenNotPaused nonReentrant returns (uint256 tokenId) {
        if (!publicMintingEnabled && !authorizedMinters[msg.sender] && msg.sender != owner()) {
            revert UnauthorizedMinter(msg.sender);
        }
        return this.mint(msg.sender, name, endpoint, capabilities, uri);
    }

    /*//////////////////////////////////////////////////////////////
                        METADATA FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Updates agent metadata
     * @param tokenId ID of the token
     * @param name New display name
     * @param endpoint New endpoint
     * @param capabilities New capabilities
     * @dev Only callable by token owner
     */
    function updateMetadata(
        uint256 tokenId,
        string calldata name,
        string calldata endpoint,
        string calldata capabilities
    ) external onlyTokenOwner(tokenId) whenNotPaused {
        if (!_exists(tokenId)) revert TokenDoesNotExist(tokenId);
        if (bytes(name).length > MAX_NAME_LENGTH) revert InvalidMetadata();
        if (bytes(endpoint).length > MAX_ENDPOINT_LENGTH) revert InvalidMetadata();
        if (bytes(capabilities).length > MAX_CAPABILITIES_LENGTH) revert InvalidMetadata();

        AgentMetadata storage metadata = agentMetadata[tokenId];
        metadata.name = name;
        metadata.endpoint = endpoint;
        metadata.capabilities = capabilities;

        emit MetadataUpdated(tokenId, name, endpoint, capabilities);
    }

    /**
     * @notice Updates agent active status
     * @param tokenId ID of the token
     * @param active New active status
     * @dev Only callable by token owner
     */
    function setActive(uint256 tokenId, bool active) external onlyTokenOwner(tokenId) whenNotPaused {
        if (!_exists(tokenId)) revert TokenDoesNotExist(tokenId);

        agentMetadata[tokenId].active = active;

        emit AgentStatusChanged(tokenId, active);
    }

    /**
     * @notice Updates token URI
     * @param tokenId ID of the token
     * @param uri New URI
     * @dev Only callable by token owner
     */
    function setTokenURI(uint256 tokenId, string calldata uri) external onlyTokenOwner(tokenId) whenNotPaused {
        if (!_exists(tokenId)) revert TokenDoesNotExist(tokenId);
        _setTokenURI(tokenId, uri);
    }

    /*//////////////////////////////////////////////////////////////
                    CREDENTIAL FUNCTIONS (ERC-8004)
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Adds a verifiable credential to an agent
     * @param tokenId ID of the token
     * @param credentialHash Hash of the credential
     * @dev Only callable by authorized issuers (owner or operators)
     */
    function addCredential(
        uint256 tokenId,
        bytes32 credentialHash
    ) external whenNotPaused {
        if (!_exists(tokenId)) revert TokenDoesNotExist(tokenId);
        if (credentialHash == bytes32(0)) revert InvalidMetadata();
        if (credentials[tokenId][credentialHash]) revert CredentialAlreadyExists(credentialHash);
        // Only owner or authorized minters can add credentials
        if (!authorizedMinters[msg.sender] && msg.sender != owner()) {
            revert UnauthorizedMinter(msg.sender);
        }

        credentials[tokenId][credentialHash] = true;
        credentialIssuers[tokenId][credentialHash] = msg.sender;
        credentialTimestamps[tokenId][credentialHash] = block.timestamp;

        emit CredentialAdded(tokenId, credentialHash, msg.sender);
    }

    /**
     * @notice Revokes a credential from an agent
     * @param tokenId ID of the token
     * @param credentialHash Hash of the credential
     * @dev Only callable by credential issuer or owner
     */
    function revokeCredential(uint256 tokenId, bytes32 credentialHash) external whenNotPaused {
        if (!_exists(tokenId)) revert TokenDoesNotExist(tokenId);
        if (!credentials[tokenId][credentialHash]) revert CredentialNotFound(credentialHash);
        if (
            credentialIssuers[tokenId][credentialHash] != msg.sender &&
            msg.sender != owner()
        ) {
            revert UnauthorizedMinter(msg.sender);
        }

        delete credentials[tokenId][credentialHash];
        delete credentialIssuers[tokenId][credentialHash];
        delete credentialTimestamps[tokenId][credentialHash];

        emit CredentialRevoked(tokenId, credentialHash);
    }

    /**
     * @notice Checks if a credential exists for an agent
     * @param tokenId ID of the token
     * @param credentialHash Hash of the credential
     * @return exists Whether the credential exists
     */
    function hasCredential(uint256 tokenId, bytes32 credentialHash) external view returns (bool exists) {
        if (!_exists(tokenId)) revert TokenDoesNotExist(tokenId);
        return credentials[tokenId][credentialHash];
    }

    /**
     * @notice Gets credential details
     * @param tokenId ID of the token
     * @param credentialHash Hash of the credential
     * @return issuer Address of the issuer
     * @return timestamp Timestamp when credential was added
     */
    function getCredentialDetails(
        uint256 tokenId,
        bytes32 credentialHash
    ) external view returns (address issuer, uint256 timestamp) {
        if (!_exists(tokenId)) revert TokenDoesNotExist(tokenId);
        if (!credentials[tokenId][credentialHash]) revert CredentialNotFound(credentialHash);
        return (
            credentialIssuers[tokenId][credentialHash],
            credentialTimestamps[tokenId][credentialHash]
        );
    }

    /*//////////////////////////////////////////////////////////////
                        ADMIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Sets authorization for a minter
     * @param minter Address to authorize
     * @param authorized Whether to authorize
     * @dev Only callable by owner
     */
    function setAuthorizedMinter(address minter, bool authorized) external onlyOwner {
        authorizedMinters[minter] = authorized;
        emit MinterAuthorized(minter, authorized);
    }

    /**
     * @notice Toggles public minting
     * @param enabled Whether to enable public minting
     * @dev Only callable by owner
     */
    function setPublicMintingEnabled(bool enabled) external onlyOwner {
        publicMintingEnabled = enabled;
        emit PublicMintingToggled(enabled);
    }

    /**
     * @notice Sets the mint fee
     * @param fee New fee amount
     * @dev Only callable by owner
     */
    function setMintFee(uint256 fee) external onlyOwner {
        uint256 oldFee = mintFee;
        mintFee = fee;
        emit MintFeeUpdated(oldFee, fee);
    }

    /**
     * @notice Sets the base URI
     * @param baseURI New base URI
     * @dev Only callable by owner
     */
    function setBaseURI(string calldata baseURI) external onlyOwner {
        _baseTokenURI = baseURI;
    }

    /**
     * @notice Pauses the contract
     * @dev Only callable by owner
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpauses the contract
     * @dev Only callable by owner
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Withdraws accumulated fees
     * @dev Only callable by owner
     */
    function withdrawFees() external onlyOwner {
        uint256 balance = address(this).balance;
        if (balance > 0) {
            (bool success, ) = payable(owner()).call{value: balance}("");
            require(success, "Withdrawal failed");
        }
    }

    /*//////////////////////////////////////////////////////////////
                        VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Gets agent metadata
     * @param tokenId ID of the token
     * @return metadata Agent metadata struct
     */
    function getAgentMetadata(uint256 tokenId) external view returns (AgentMetadata memory metadata) {
        if (!_exists(tokenId)) revert TokenDoesNotExist(tokenId);
        return agentMetadata[tokenId];
    }

    /**
     * @notice Gets token ID for an address
     * @param owner Address to lookup
     * @return tokenId Token ID (0 if none)
     */
    function getTokenIdByOwner(address owner) external view returns (uint256 tokenId) {
        return agentTokenId[owner];
    }

    /**
     * @notice Checks if an address has an identity
     * @param owner Address to check
     * @return hasIdentity Whether the address has an identity
     */
    function hasIdentity(address owner) external view returns (bool hasIdentity) {
        return agentTokenId[owner] != 0;
    }

    /**
     * @notice Returns the total supply
     * @return Total number of tokens minted
     */
    function totalSupply() public view override(ERC721Enumerable) returns (uint256) {
        return _tokenIdCounter;
    }

    /**
     * @notice Returns the base URI
     * @return Base URI string
     */
    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    /*//////////////////////////////////////////////////////////////
                        ERC-8004 COMPATIBILITY
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice ERC-8004: Gets the DID document URI for an agent
     * @param tokenId ID of the token
     * @return didDocumentURI URI of the DID document
     */
    function didDocumentURI(uint256 tokenId) external view returns (string memory) {
        if (!_exists(tokenId)) revert TokenDoesNotExist(tokenId);
        return string(abi.encodePacked(_baseTokenURI, "did/", _toString(tokenId)));
    }

    /**
     * @notice ERC-8004: Verifies if a credential is valid for an agent
     * @param tokenId ID of the token
     * @param credentialHash Hash of the credential
     * @return valid Whether the credential is valid
     */
    function verifyCredential(uint256 tokenId, bytes32 credentialHash) external view returns (bool valid) {
        if (!_exists(tokenId)) revert TokenDoesNotExist(tokenId);
        return credentials[tokenId][credentialHash];
    }

    /**
     * @notice ERC-8004: Gets the service endpoint for an agent
     * @param tokenId ID of the token
     * @return endpoint Service endpoint URL
     */
    function serviceEndpoint(uint256 tokenId) external view returns (string memory endpoint) {
        if (!_exists(tokenId)) revert TokenDoesNotExist(tokenId);
        return agentMetadata[tokenId].endpoint;
    }

    /*//////////////////////////////////////////////////////////////
                        INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Checks if a token exists
     * @param tokenId ID of the token
     * @return exists Whether the token exists
     */
    function _exists(uint256 tokenId) internal view returns (bool exists) {
        return _ownerOf(tokenId) != address(0);
    }

    /**
     * @notice Converts uint256 to string
     * @param value Value to convert
     * @return string representation
     */
    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits--;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    /**
     * @notice Hook called before any token transfer
     * @dev Updates agentTokenId mapping on transfer
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override(ERC721, ERC721Enumerable) whenNotPaused {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);

        // Update agentTokenId mapping
        if (from != address(0)) {
            agentTokenId[from] = 0;
        }
        if (to != address(0)) {
            // Check if recipient already has an identity
            if (agentTokenId[to] != 0 && agentTokenId[to] != tokenId) {
                revert IdentityAlreadyExists(to);
            }
            agentTokenId[to] = tokenId;
        }
    }

    /**
     * @notice Burns a token
     * @param tokenId ID of the token to burn
     */
    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }

    /**
     * @notice Returns token URI
     * @param tokenId ID of the token
     * @return URI string
     */
    function tokenURI(
        uint256 tokenId
    ) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    /**
     * @notice Checks if contract supports an interface
     * @param interfaceId Interface ID to check
     * @return supported Whether the interface is supported
     */
    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721, ERC721Enumerable, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
