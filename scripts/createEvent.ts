import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

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
    "Contract address not found (set CONTRACT_ADDRESS in .env or deploy first)"
  );
}

async function main() {
  const contractAddress = loadContractAddress();
  const [owner] = await ethers.getSigners();

  const eventId = ethers.keccak256(
    ethers.toUtf8Bytes("monad-blitz-ankara-2026")
  );
  const name = "Monad Blitz Ankara";
  const now = Math.floor(Date.now() / 1000);
  const startTime = now - 600;
  const endTime = now + 86400;

  console.log("Owner:", owner.address);
  console.log("Contract:", contractAddress);
  console.log("eventId (bytes32):", eventId);
  console.log("name:", name);
  console.log("startTime:", startTime, new Date(startTime * 1000).toISOString());
  console.log("endTime:", endTime, new Date(endTime * 1000).toISOString());

  const contract = await ethers.getContractAt("MonadStamp", contractAddress);
  const tx = await contract.createEvent(eventId, name, startTime, endTime);
  console.log("Transaction hash:", tx.hash);

  const receipt = await tx.wait();
  console.log("Event created in block:", receipt?.blockNumber);
  console.log("\n--- Use this eventId for frontend and admin QR ---");
  console.log(eventId);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
