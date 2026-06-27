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

export async function requestMint(
  payload: MintRelayRequest
): Promise<MintRelayResponse> {
  const response = await fetch(`${RELAY_URL}/mint`, {
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
