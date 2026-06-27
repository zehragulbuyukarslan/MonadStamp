import { ethers } from "ethers";

export const EIP712_DOMAIN = {
  name: "MonadStamp",
  version: "1",
  chainId: 10143,
} as const;

export const EIP712_TYPES = {
  MintStamp: [
    { name: "recipient", type: "address" },
    { name: "eventId", type: "bytes32" },
    { name: "timestamp", type: "uint256" },
  ],
};

export function parseEventId(eventId: string): string {
  if (ethers.isHexString(eventId, 32)) {
    return eventId;
  }
  return ethers.id(eventId);
}

export function buildMintMessage(
  recipient: string,
  eventId: string,
  timestamp: number
) {
  return {
    recipient,
    eventId: parseEventId(eventId),
    timestamp,
  };
}
