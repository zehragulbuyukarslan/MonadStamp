import { BrowserProvider, Eip1193Provider } from "ethers";
import { CHAIN_ID, MONAD_NETWORK } from "./config";
import { EIP712_DOMAIN, EIP712_TYPES, buildMintMessage } from "./eip712";

type EthereumProvider = Eip1193Provider & { isMetaMask?: boolean };

declare global {
  interface Window {
    ethereum?: EthereumProvider & { providers?: EthereumProvider[] };
  }
}

let eip6963Provider: EthereumProvider | null = null;
let discoveryStarted = false;

function normalizeChainId(chainId: string): string {
  return chainId.toLowerCase();
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

export function startWalletDiscovery(): void {
  if (discoveryStarted || typeof window === "undefined") {
    return;
  }
  discoveryStarted = true;

  window.addEventListener("eip6963:announceProvider", (event: Event) => {
    const detail = (event as CustomEvent<{
      provider: EthereumProvider;
      info: { name: string; rdns: string };
    }>).detail;

    if (detail.info.rdns === "io.metamask") {
      eip6963Provider = detail.provider;
      return;
    }
    if (!eip6963Provider) {
      eip6963Provider = detail.provider;
    }
  });

  window.dispatchEvent(new Event("eip6963:requestProvider"));
}

export function isWalletInstalled(): boolean {
  if (eip6963Provider) {
    return true;
  }
  return typeof window !== "undefined" && !!window.ethereum;
}

export function getEthereum(): EthereumProvider {
  if (eip6963Provider) {
    return eip6963Provider;
  }

  const { ethereum } = window;
  if (!ethereum) {
    throw new Error(
      "MetaMask bulunamadı. MetaMask eklentisini kurun ve sayfayı yenileyin."
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

export async function getConnectedAddress(): Promise<string | null> {
  if (!isWalletInstalled()) {
    return null;
  }

  try {
    const accounts = (await getEthereum().request({
      method: "eth_accounts",
    })) as string[];
    return accounts[0] ?? null;
  } catch {
    return null;
  }
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
      throw new Error(
        "Ağ değişikliği reddedildi. MetaMask'ta Monad Testnet'i onaylayın."
      );
    }
    if (switchError.code === 4902) {
      await ethereum.request({
        method: "wallet_addEthereumChain",
        params: [MONAD_NETWORK],
      });
      return;
    }
    throw new Error(
      switchError.message ?? "Monad Testnet'e geçilemedi"
    );
  }
}

export async function connectWallet(): Promise<string> {
  const ethereum = getEthereum();

  const accounts = await withTimeout(
    ethereum.request({ method: "eth_requestAccounts" }) as Promise<string[]>,
    120_000,
    "MetaMask yanıt vermedi. Eklenti simgesine tıklayıp bağlantıyı onaylayın."
  );

  if (!accounts[0]) {
    throw new Error("Hesap seçilmedi");
  }

  await ensureMonadNetwork();

  const provider = getProvider();
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== CHAIN_ID) {
    throw new Error("Lütfen MetaMask'ta Monad Testnet'e geçin.");
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
    throw new Error("Bağlı cüzdan adresi eşleşmiyor");
  }

  return signer.signTypedData(
    EIP712_DOMAIN,
    { MintStamp: EIP712_TYPES.MintStamp },
    buildMintMessage(recipient, eventId, timestamp)
  );
}
