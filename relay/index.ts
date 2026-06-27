import express from "express";
import cors from "cors";
import { ethers } from "ethers";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import MonadStampArtifact from "../artifacts/contracts/MonadStamp.sol/MonadStamp.json";
import {
  CHAIN_ID,
  EIP712_DOMAIN,
  EIP712_TYPES,
  parseEventId,
} from "./eip712";

dotenv.config();

const TIMESTAMP_WINDOW_SEC = 5 * 60;
const DEFAULT_RPC = "https://testnet-rpc.monad.xyz";
const DEFAULT_PORT = 3001;

interface MintRequestBody {
  recipient: string;
  eventId: string;
  timestamp: number | string;
  signature: string;
}

function loadContractAddress(): string {
  const fromEnv = process.env.CONTRACT_ADDRESS;
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

async function main() {
  const relayerPrivateKey = process.env.RELAYER_PRIVATE_KEY;
  if (!relayerPrivateKey) {
    throw new Error("RELAYER_PRIVATE_KEY is required in .env");
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

  const onChainRelayer = await contract.relayer();
  if (onChainRelayer.toLowerCase() !== relayer.address.toLowerCase()) {
    throw new Error(
      `Relayer wallet ${relayer.address} does not match contract relayer ${onChainRelayer}`
    );
  }

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      relayer: relayer.address,
      contract: contractAddress,
      chainId: CHAIN_ID,
    });
  });

  app.post("/mint", async (req, res) => {
    try {
      const body = req.body as MintRequestBody;
      const { recipient, eventId, timestamp, signature } = body;

      if (!recipient || !eventId || timestamp === undefined || !signature) {
        res.status(400).json({
          success: false,
          error: "Missing required fields: recipient, eventId, timestamp, signature",
        });
        return;
      }

      if (!ethers.isAddress(recipient)) {
        res.status(400).json({ success: false, error: "Invalid recipient address" });
        return;
      }

      const eventIdBytes32 = parseEventId(eventId);
      const signedTimestamp = parseTimestamp(timestamp);
      const now = Math.floor(Date.now() / 1000);

      if (Math.abs(now - signedTimestamp) > TIMESTAMP_WINDOW_SEC) {
        res.status(400).json({
          success: false,
          error: "Signature timestamp expired (must be within 5 minutes)",
        });
        return;
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
        res.status(400).json({
          success: false,
          error: "Invalid signature",
        });
        return;
      }

      const alreadyClaimed = await contract.claimed(eventIdBytes32, recipient);
      if (alreadyClaimed) {
        res.status(400).json({
          success: false,
          error: "Stamp already claimed for this event",
        });
        return;
      }

      const tx = await contract.mintStamp(recipient, eventIdBytes32);
      const receipt = await tx.wait();

      res.json({
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown relay error";
      res.status(500).json({ success: false, error: message });
    }
  });

  const port = Number(process.env.PORT ?? DEFAULT_PORT);
  app.listen(port, () => {
    console.log(`MonadStamp relay listening on http://localhost:${port}`);
    console.log(`Contract: ${contractAddress}`);
    console.log(`Relayer:  ${relayer.address}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
