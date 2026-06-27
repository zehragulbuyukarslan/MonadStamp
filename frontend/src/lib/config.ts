export const CHAIN_ID = 10143;
export const CHAIN_ID_HEX = "0x279f";
export const RPC_URL =
  import.meta.env.VITE_RPC_URL ?? "https://testnet-rpc.monad.xyz";
export const EXPLORER_URL = "https://testnet.monadvision.com";
export const RELAY_URL = import.meta.env.VITE_RELAY_URL ?? "/api";
export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS ?? "";

export const MONAD_NETWORK = {
  chainId: CHAIN_ID_HEX,
  chainName: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: [RPC_URL],
  blockExplorerUrls: [EXPLORER_URL],
};
