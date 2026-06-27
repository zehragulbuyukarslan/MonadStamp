import { BrowserProvider, Eip1193Provider } from "ethers";
import { CHAIN_ID, MONAD_NETWORK } from "./config";
import { EIP712_DOMAIN, EIP712_TYPES, buildMintMessage } from "./eip712";

type EthereumProvider = Eip1193Provider & { isMetaMask?: boolean };

declare global {
  interface Window {
    ethereum?: EthereumProvider & { providers?: EthereumProvider[] };
  }
}

function normalizeChainId(chainId: string): string {
  return chainId.toLowerCase();
}

export function getEthereum(): EthereumProvider {
  const { ethereum } = window;
  if (!ethereum) {
    throw new Error(
      "No wallet found. Install MetaMask and refresh the page."
    );
  }

  if (Array.isArray(ethereum.providers) && ethereum.providers.length > 0) {
    const metaMask = ethereum.providers.find((p) => p.isMetaMask);
    return metaMask ?? ethereum.providers[0];
  }

  return ethereum;
}

export function getProvider(): BrowserProvider {
  return new BrowserProvider(getEthereum());
}

export async function ensureMonadNetwork(): Promise<void> {
  const ethereum = getEthereum();
  const targetChainId = normalizeChainId(MONAD_NETWORK.chainId);

  const currentChainId = normalizeChainId(
    (await ethereum.request({ method: "eth_chainId" })) as string
  );
  if (currentChainId === targetChainId) {
    return;
  }

  try {
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: MONAD_NETWORK.chainId }],
    });
  } catch (error) {
    const switchError = error as { code?: number; message?: string };
    if (switchError.code === 4001) {
      throw new Error("Network switch rejected. Approve Monad Testnet in your wallet.");
    }
    if (switchError.code === 4902) {
      await ethereum.request({
        method: "wallet_addEthereumChain",
        params: [MONAD_NETWORK],
      });
      return;
    }
    throw new Error(
      switchError.message ?? "Failed to switch to Monad Testnet"
    );
  }
}

export async function connectWallet(): Promise<string> {
  const ethereum = getEthereum();
  await ensureMonadNetwork();

  const accounts = (await ethereum.request({
    method: "eth_requestAccounts",
  })) as string[];

  if (!accounts[0]) {
    throw new Error("No account selected");
  }

  const provider = getProvider();
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== CHAIN_ID) {
    throw new Error("Please switch to Monad Testnet in your wallet.");
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
