import { ethers } from "ethers";

export const CHAIN_ID = 10143;

export const EIP712_DOMAIN = {
  name: "MonadStamp",
  version: "1",
  chainId: CHAIN_ID,
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

export function buildMintTypedData(
  recipient: string,
  eventId: string,
  timestamp: number
) {
  return {
    domain: EIP712_DOMAIN,
    types: EIP712_TYPES,
    primaryType: "MintStamp" as const,
    message: {
      recipient,
      eventId: parseEventId(eventId),
      timestamp,
    },
  };
}
