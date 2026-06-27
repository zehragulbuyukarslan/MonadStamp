// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";

contract MonadStamp is ERC721, Ownable {
    using Strings for uint256;

    address public immutable relayer;

    struct EventInfo {
        string name;
        uint256 startTime;
        uint256 endTime;
        bool exists;
    }

    mapping(bytes32 => EventInfo) public events;
    mapping(bytes32 => mapping(address => bool)) public claimed;
    mapping(uint256 => bytes32) public tokenEventId;
    mapping(uint256 => uint256) public tokenMintedAt;
    mapping(uint256 => uint256) public tokenMintBlock;

    uint256 private _nextTokenId;

    event EventCreated(
        bytes32 indexed eventId,
        string name,
        uint256 startTime,
        uint256 endTime
    );
    event StampMinted(
        bytes32 indexed eventId,
        address indexed recipient,
        uint256 indexed tokenId
    );

    error SoulBound();
    error NotRelayer();
    error EventAlreadyExists();
    error EventNotFound();
    error InvalidEventWindow();
    error AlreadyClaimed();
    error EventNotActive();

    constructor(address _relayer) ERC721("MonadStamp", "STAMP") Ownable(msg.sender) {
        require(_relayer != address(0), "Invalid relayer");
        relayer = _relayer;
    }

    function createEvent(
        bytes32 eventId,
        string calldata name,
        uint256 startTime,
        uint256 endTime
    ) external onlyOwner {
        if (events[eventId].exists) revert EventAlreadyExists();
        if (endTime <= startTime) revert InvalidEventWindow();

        events[eventId] = EventInfo({
            name: name,
            startTime: startTime,
            endTime: endTime,
            exists: true
        });

        emit EventCreated(eventId, name, startTime, endTime);
    }

    function mintStamp(address recipient, bytes32 eventId) external {
        if (msg.sender != relayer) revert NotRelayer();

        EventInfo storage eventInfo = events[eventId];
        if (!eventInfo.exists) revert EventNotFound();

        uint256 now_ = block.timestamp;
        if (now_ < eventInfo.startTime || now_ > eventInfo.endTime) {
            revert EventNotActive();
        }
        if (claimed[eventId][recipient]) revert AlreadyClaimed();

        claimed[eventId][recipient] = true;

        uint256 tokenId = _nextTokenId++;
        tokenEventId[tokenId] = eventId;
        tokenMintedAt[tokenId] = now_;
        tokenMintBlock[tokenId] = block.number;

        _safeMint(recipient, tokenId);

        emit StampMinted(eventId, recipient, tokenId);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);

        bytes32 eventId = tokenEventId[tokenId];
        EventInfo storage eventInfo = events[eventId];
        uint256 mintedAt = tokenMintedAt[tokenId];
        uint256 mintBlock = tokenMintBlock[tokenId];

        string memory json = string(
            abi.encodePacked(
                '{"name":"MonadStamp: ',
                _escapeJson(eventInfo.name),
                '","description":"Soul-bound attendance stamp on Monad Testnet","attributes":[',
                '{"trait_type":"eventId","value":"',
                Strings.toHexString(uint256(eventId), 32),
                '"},',
                '{"trait_type":"eventName","value":"',
                _escapeJson(eventInfo.name),
                '"},',
                '{"trait_type":"timestamp","value":"',
                mintedAt.toString(),
                '"},',
                '{"trait_type":"blockNumber","value":"',
                mintBlock.toString(),
                '"}',
                "]}"
            )
        );

        return string(
            abi.encodePacked(
                "data:application/json;base64,",
                Base64.encode(bytes(json))
            )
        );
    }

    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0)) revert SoulBound();
        return super._update(to, tokenId, auth);
    }

    function _escapeJson(string memory input) private pure returns (string memory) {
        bytes memory inputBytes = bytes(input);
        uint256 escapeCount;

        for (uint256 i = 0; i < inputBytes.length; i++) {
            if (inputBytes[i] == '"' || inputBytes[i] == "\\") {
                escapeCount++;
            }
        }

        if (escapeCount == 0) {
            return input;
        }

        bytes memory escaped = new bytes(inputBytes.length + escapeCount);
        uint256 writeIndex;

        for (uint256 i = 0; i < inputBytes.length; i++) {
            if (inputBytes[i] == '"' || inputBytes[i] == "\\") {
                escaped[writeIndex++] = "\\";
            }
            escaped[writeIndex++] = inputBytes[i];
        }

        return string(escaped);
    }
}
