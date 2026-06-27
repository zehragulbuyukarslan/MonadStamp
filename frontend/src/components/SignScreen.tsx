import { useState } from "react";
import { EventPayload } from "../lib/qr";
import { connectWallet, signMintStamp } from "../lib/wallet";
import { requestMint } from "../lib/relay";

export interface MintResult {
  txHash: string;
  blockNumber: number;
}

interface SignScreenProps {
  event: EventPayload;
  onSuccess: (result: MintResult) => void;
  onBack: () => void;
}

export function SignScreen({ event, onSuccess, onBack }: SignScreenProps) {
  const [wallet, setWallet] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConnect() {
    try {
      setError(null);
      const address = await connectWallet();
      setWallet(address);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wallet connection failed");
    }
  }

  async function handleMint() {
    try {
      setLoading(true);
      setError(null);

      const address = wallet ?? (await connectWallet());
      setWallet(address);

      const timestamp = Math.floor(Date.now() / 1000);
      const signature = await signMintStamp(address, event.eventId, timestamp);
      const result = await requestMint({
        recipient: address,
        eventId: event.eventId,
        timestamp,
        signature,
      });

      if (!result.txHash || result.blockNumber === undefined) {
        throw new Error("Relay did not return transaction details");
      }

      onSuccess({ txHash: result.txHash, blockNumber: result.blockNumber });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mint failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col px-4 pb-8 pt-10">
      <button
        type="button"
        onClick={onBack}
        className="mb-6 self-start text-sm text-white/60 hover:text-white"
      >
        ← Back
      </button>

      <div className="mx-auto w-full max-w-sm animate-fade-in">
        <p className="text-sm uppercase tracking-[0.2em] text-monad-glow">
          Check-in
        </p>
        <h1 className="mt-2 text-3xl font-bold leading-tight">
          {event.eventName}
        </h1>
        <p className="mt-3 text-sm text-white/70">
          Sign with your wallet to mint your soul-bound attendance stamp. Gas is
          covered by the relay.
        </p>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-wide text-white/50">
            Event ID
          </p>
          <p className="mt-1 break-all font-mono text-sm">{event.eventId}</p>
        </div>

        {wallet && (
          <div className="mt-4 rounded-2xl border border-monad-purple/30 bg-monad-purple/10 p-4">
            <p className="text-xs uppercase tracking-wide text-monad-glow">
              Connected
            </p>
            <p className="mt-1 break-all font-mono text-sm">{wallet}</p>
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        )}

        <div className="mt-8 space-y-3">
          {!wallet && (
            <button
              type="button"
              onClick={handleConnect}
              disabled={loading}
              className="w-full rounded-xl border border-white/20 py-3 font-semibold transition hover:bg-white/5 disabled:opacity-50"
            >
              Connect Wallet
            </button>
          )}
          <button
            type="button"
            onClick={handleMint}
            disabled={loading}
            className="w-full rounded-xl bg-monad-purple py-4 text-lg font-bold shadow-lg shadow-monad-purple/30 transition hover:bg-monad-purple/90 disabled:opacity-50"
          >
            {loading ? "Minting…" : "Mint your stamp"}
          </button>
        </div>
      </div>
    </div>
  );
}
