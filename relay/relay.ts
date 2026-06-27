import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import MonadStampArtifact from "./MonadStamp.json";
import {
  CHAIN_ID,
  EIP712_DOMAIN,
  EIP712_TYPES,
  parseEventId,
} from "./eip712";

const TIMESTAMP_WINDOW_SEC = 5 * 60;
const DEFAULT_RPC = "https://testnet-rpc.monad.xyz";
const RPC_RETRY_ATTEMPTS = 4;
const RPC_RETRY_DELAY_MS = 750;

async function withRpcRetry<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= RPC_RETRY_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const isRateLimited =
        error instanceof Error &&
        (error.message.includes("requests limited") ||
          (error as { info?: { error?: { code?: number } } }).info?.error
            ?.code === -32011);

      if (!isRateLimited || attempt === RPC_RETRY_ATTEMPTS) {
        throw error;
      }

      await new Promise((resolve) =>
        setTimeout(resolve, RPC_RETRY_DELAY_MS * attempt)
      );
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`${operation} failed after ${RPC_RETRY_ATTEMPTS} attempts`);
}

function formatRpcError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Monad RPC is temporarily unavailable. Try again shortly.";
  }

  const text = error.message;
  if (text.includes("requests limited") || text.includes("CALL_EXCEPTION")) {
    return "Monad RPC is temporarily unavailable. Try again shortly.";
  }

  return text;
}

const CONTRACT_ERROR_MESSAGES: Record<string, string> = {
  EventNotFound: "Event not found on chain. Ask the organizer for a valid QR code.",
  EventNotActive: "Event check-in window is closed.",
  AlreadyClaimed: "Stamp already claimed for this event.",
  NotRelayer: "Relay is not authorized for this contract.",
};

function formatContractError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Mint transaction failed";
  }

  const err = error as Error & { shortMessage?: string; reason?: string };
  const text = `${err.shortMessage ?? ""} ${err.reason ?? ""} ${err.message}`;

  for (const [name, message] of Object.entries(CONTRACT_ERROR_MESSAGES)) {
    if (text.includes(name)) {
      return message;
    }
  }

  if (text.includes("insufficient funds")) {
    return "Relay wallet has insufficient funds for gas.";
  }

  return err.shortMessage ?? err.message ?? "Mint transaction failed";
}

export interface MintRequestBody {
  recipient: string;
  eventId: string;
  timestamp: number | string;
  signature: string;
}

export interface HealthResponse {
  ok: boolean;
  relayer: string;
  contract: string;
  chainId: number;
}

export interface MintSuccessResponse {
  success: true;
  txHash: string;
  blockNumber: number;
}

export interface MintErrorResponse {
  success: false;
  error: string;
}

export type MintResponse = MintSuccessResponse | MintErrorResponse;

export function loadContractAddress(): string {
  const fromEnv = process.env.CONTRACT_ADDRESS ?? process.env.VITE_CONTRACT_ADDRESS;
  if (fromEnv && ethers.isAddress(fromEnv)) {
    return fromEnv;
  }

  const deploymentPath = path.join(
    __dirname,
    "..",
    "deployments",
    "monadTestnet.json"
  );
  if (fs.existsSync(deploymentPath)) {
    const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8")) as {
      contractAddress?: string;
    };
    if (
      deployment.contractAddress &&
      ethers.isAddress(deployment.contractAddress)
    ) {
      return deployment.contractAddress;
    }
  }

  throw new Error(
    "CONTRACT_ADDRESS is required (set in .env or deploy the contract first)"
  );
}

function parseTimestamp(timestamp: number | string): number {
  const value = typeof timestamp === "string" ? Number(timestamp) : timestamp;
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Invalid timestamp");
  }
  return Math.floor(value);
}

interface RelayContext {
  relayer: ethers.Wallet;
  contract: ethers.Contract;
  contractAddress: string;
}

let cachedContext: RelayContext | null = null;

export async function getRelayContext(): Promise<RelayContext> {
  if (cachedContext) {
    return cachedContext;
  }

  const relayerPrivateKey = process.env.RELAYER_PRIVATE_KEY;
  if (!relayerPrivateKey) {
    throw new Error("RELAYER_PRIVATE_KEY is required");
  }

  const rpcUrl = process.env.MONAD_RPC_URL ?? DEFAULT_RPC;
  const contractAddress = loadContractAddress();
  const provider = new ethers.JsonRpcProvider(rpcUrl, CHAIN_ID);
  const relayer = new ethers.Wallet(relayerPrivateKey, provider);
  const contract = new ethers.Contract(
    contractAddress,
    MonadStampArtifact.abi,
    relayer
  );

  const onChainRelayer = await withRpcRetry("relayer lookup", () =>
    contract.relayer()
  );
  if (onChainRelayer.toLowerCase() !== relayer.address.toLowerCase()) {
    throw new Error(
      `Relayer wallet ${relayer.address} does not match contract relayer ${onChainRelayer}`
    );
  }

  cachedContext = { relayer, contract, contractAddress };
  return cachedContext;
}

export async function getHealthResponse(): Promise<HealthResponse> {
  const { relayer, contractAddress } = await getRelayContext();
  return {
    ok: true,
    relayer: relayer.address,
    contract: contractAddress,
    chainId: CHAIN_ID,
  };
}

export async function processMint(
  body: MintRequestBody
): Promise<{ status: number; body: MintResponse }> {
  const { recipient, eventId, timestamp, signature } = body;

  if (!recipient || !eventId || timestamp === undefined || !signature) {
    return {
      status: 400,
      body: {
        success: false,
        error:
          "Missing required fields: recipient, eventId, timestamp, signature",
      },
    };
  }

  if (!ethers.isAddress(recipient)) {
    return {
      status: 400,
      body: { success: false, error: "Invalid recipient address" },
    };
  }

  const eventIdBytes32 = parseEventId(eventId);
  const signedTimestamp = parseTimestamp(timestamp);
  const now = Math.floor(Date.now() / 1000);

  if (Math.abs(now - signedTimestamp) > TIMESTAMP_WINDOW_SEC) {
    return {
      status: 400,
      body: {
        success: false,
        error: "Signature timestamp expired (must be within 5 minutes)",
      },
    };
  }

  const message = {
    recipient,
    eventId: eventIdBytes32,
    timestamp: signedTimestamp,
  };

  const recovered = ethers.verifyTypedData(
    EIP712_DOMAIN,
    EIP712_TYPES,
    message,
    signature
  );

  if (recovered.toLowerCase() !== recipient.toLowerCase()) {
    return {
      status: 400,
      body: { success: false, error: "Invalid signature" },
    };
  }

  const { contract } = await getRelayContext();

  let eventInfo: {
    exists: boolean;
    startTime: bigint;
    endTime: bigint;
  };

  try {
    eventInfo = await withRpcRetry("event lookup", () =>
      contract.events(eventIdBytes32)
    );
  } catch (error) {
    const message = formatRpcError(error);
    return {
      status: 503,
      body: { success: false, error: message },
    };
  }

  if (!eventInfo.exists) {
    return {
      status: 400,
      body: {
        success: false,
        error: CONTRACT_ERROR_MESSAGES.EventNotFound,
      },
    };
  }

  const provider = contract.runner?.provider;
  if (provider) {
    try {
      const latestBlock = await withRpcRetry("latest block lookup", () =>
        provider.getBlock("latest")
      );
      const chainNow = latestBlock?.timestamp ?? Math.floor(Date.now() / 1000);
      if (chainNow < eventInfo.startTime || chainNow > eventInfo.endTime) {
        return {
          status: 400,
          body: {
            success: false,
            error: CONTRACT_ERROR_MESSAGES.EventNotActive,
          },
        };
      }
    } catch (error) {
      return {
        status: 503,
        body: { success: false, error: formatRpcError(error) },
      };
    }
  }

  let alreadyClaimed: boolean;
  try {
    alreadyClaimed = await withRpcRetry("claimed lookup", () =>
      contract.claimed(eventIdBytes32, recipient)
    );
  } catch (error) {
    return {
      status: 503,
      body: { success: false, error: formatRpcError(error) },
    };
  }

  if (alreadyClaimed) {
    return {
      status: 400,
      body: {
        success: false,
        error: "Stamp already claimed for this event",
      },
    };
  }

  try {
    const tx = await contract.mintStamp(recipient, eventIdBytes32);
    const receipt = await tx.wait();

    if (!receipt) {
      return {
        status: 500,
        body: {
          success: false,
          error: "Transaction submitted but no receipt received",
        },
      };
    }

    return {
      status: 200,
      body: {
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      },
    };
  } catch (error) {
    const rpcMessage = formatRpcError(error);
    const isRpcFailure = rpcMessage.includes("RPC is temporarily unavailable");
    const message = isRpcFailure ? rpcMessage : formatContractError(error);
    return {
      status: isRpcFailure ? 503 : 400,
      body: { success: false, error: message },
    };
  }
}
