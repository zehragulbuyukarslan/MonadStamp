import { BrowserProvider, Eip1193Provider } from "ethers";
import { CHAIN_ID, MONAD_NETWORK } from "./config";
import { EIP712_DOMAIN, EIP712_TYPES, buildMintMessage } from "./eip712";

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

export function getProvider(): BrowserProvider {
  if (!window.ethereum) {
    throw new Error("No wallet found. Install MetaMask or use a Web3 browser.");
  }
  return new BrowserProvider(window.ethereum);
}

export async function ensureMonadNetwork(): Promise<void> {
  if (!window.ethereum) {
    throw new Error("No wallet found");
  }

  const chainId = await window.ethereum.request({ method: "eth_chainId" });
  if (chainId === MONAD_NETWORK.chainId) {
    return;
  }

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: MONAD_NETWORK.chainId }],
    });
  } catch (error) {
    const switchError = error as { code?: number };
    if (switchError.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [MONAD_NETWORK],
      });
      return;
    }
    throw error;
  }
}

export async function connectWallet(): Promise<string> {
  const provider = getProvider();
  await ensureMonadNetwork();
  const accounts = (await provider.send("eth_requestAccounts", [])) as string[];
  if (!accounts[0]) {
    throw new Error("No account selected");
  }

  const network = await provider.getNetwork();
  if (Number(network.chainId) !== CHAIN_ID) {
    throw new Error("Please switch to Monad Testnet");
  }

  return accounts[0];
}

export async function signMintStamp(
  recipient: string,
  eventId: string,
  timestamp: number
): Promise<string> {
  const provider = getProvider();
  await ensureMonadNetwork();
  const signer = await provider.getSigner();
  const address = await signer.getAddress();

  if (address.toLowerCase() !== recipient.toLowerCase()) {
    throw new Error("Connected wallet does not match recipient");
  }

  return signer.signTypedData(
    EIP712_DOMAIN,
    { MintStamp: EIP712_TYPES.MintStamp },
    buildMintMessage(recipient, eventId, timestamp)
  );
}
