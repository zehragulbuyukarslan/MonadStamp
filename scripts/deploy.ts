import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const relayerAddress = process.env.RELAYER_ADDRESS;
  if (!relayerAddress) {
    throw new Error("RELAYER_ADDRESS is required in .env");
  }

  if (!ethers.isAddress(relayerAddress)) {
    throw new Error(`RELAYER_ADDRESS is not a valid address: ${relayerAddress}`);
  }

  const [deployer] = await ethers.getSigners();
  console.log("Deploying MonadStamp with account:", deployer.address);
  console.log("Relayer address:", relayerAddress);

  const factory = await ethers.getContractFactory("MonadStamp");
  const contract = await factory.deploy(relayerAddress);
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  const network = await ethers.provider.getNetwork();

  console.log("MonadStamp deployed to:", contractAddress);
  console.log("Chain ID:", network.chainId.toString());

  const deploymentsDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(deploymentsDir, { recursive: true });

  const deployment = {
    contractAddress,
    relayerAddress,
    deployerAddress: deployer.address,
    chainId: Number(network.chainId),
    deployedAt: new Date().toISOString(),
  };

  fs.writeFileSync(
    path.join(deploymentsDir, "monadTestnet.json"),
    JSON.stringify(deployment, null, 2)
  );

  console.log("Deployment saved to deployments/monadTestnet.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
