export const MONADSTAMP_ABI = [
  "event StampMinted(bytes32 indexed eventId, address indexed recipient, uint256 indexed tokenId)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
  "function events(bytes32 eventId) view returns (string name, uint256 startTime, uint256 endTime, bool exists)",
] as const;
