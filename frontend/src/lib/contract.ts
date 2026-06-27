import { Contract, JsonRpcProvider, Provider } from "ethers";
import { CHAIN_ID, CONTRACT_ADDRESS, RPC_URL } from "./config";
import { MONADSTAMP_ABI } from "./abi";

export function getReadProvider(): JsonRpcProvider {
  return new JsonRpcProvider(RPC_URL, CHAIN_ID);
}

export function getMonadStampContract(
  provider: Provider | JsonRpcProvider = getReadProvider()
): Contract {
  if (!CONTRACT_ADDRESS) {
    throw new Error("VITE_CONTRACT_ADDRESS is not configured");
  }
  return new Contract(CONTRACT_ADDRESS, MONADSTAMP_ABI, provider);
}

export function shortAddress(address: string): string {
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
