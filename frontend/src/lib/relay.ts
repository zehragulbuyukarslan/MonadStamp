import { RELAY_URL } from "./config";

export interface MintRelayRequest {
  recipient: string;
  eventId: string;
  timestamp: number;
  signature: string;
}

export interface MintRelayResponse {
  success: boolean;
  txHash?: string;
  blockNumber?: number;
  error?: string;
}

export interface RelayHealthResponse {
  ok?: boolean;
  relayer?: string;
  contract?: string;
  chainId?: number;
  error?: string;
}

const REQUEST_TIMEOUT_MS = 60_000;

async function fetchWithTimeout(
  url: string,
  init: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Relay request timed out. Try again in a moment.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function checkRelayHealth(): Promise<RelayHealthResponse> {
  const response = await fetchWithTimeout(`${RELAY_URL}/health`, {
    method: "GET",
  });
  return (await response.json()) as RelayHealthResponse;
}

export async function requestMint(
  payload: MintRelayRequest
): Promise<MintRelayResponse> {
  const response = await fetchWithTimeout(`${RELAY_URL}/mint`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as MintRelayResponse;
  if (!response.ok || !data.success) {
    throw new Error(data.error ?? "Mint request failed");
  }
  return data;
}
