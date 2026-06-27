import { useEffect, useState } from "react";
import { EventPayload } from "../lib/qr";
import { connectWallet, signMintStamp } from "../lib/wallet";
import { checkRelayHealth, requestMint } from "../lib/relay";

export interface MintResult {
  txHash: string;
  blockNumber: number;
}

interface SignScreenProps {
  event: EventPayload;
  onSuccess: (result: MintResult) => void;
  onBack: () => void;
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function SignScreen({ event, onSuccess, onBack }: SignScreenProps) {
  const [wallet, setWallet] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [minting, setMinting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [relayOk, setRelayOk] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    checkRelayHealth()
      .then((health) => {
        if (cancelled) return;
        if (health.ok) {
          setRelayOk(true);
          return;
        }
        setRelayOk(false);
        setError(health.error ?? "Relay server is not configured");
      })
      .catch(() => {
        if (cancelled) return;
        setRelayOk(false);
        setError("Cannot reach relay server. Minting will not work.");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleConnect() {
    try {
      setConnecting(true);
      setError(null);
      setStatus("Approve the connection in your wallet (check the MetaMask popup)…");
      const address = await connectWallet();
      setWallet(address);
      setStatus(null);
    } catch (err) {
      setStatus(null);
      if (err instanceof Error && err.message.includes("rejected")) {
        setError("Connection rejected. Click Connect Wallet and approve in MetaMask.");
      } else {
        setError(err instanceof Error ? err.message : "Wallet connection failed");
      }
    } finally {
      setConnecting(false);
    }
  }

  async function handleMint() {
    if (!wallet) {
      setError("Connect your wallet first.");
      return;
    }

    try {
      setMinting(true);
      setError(null);
      setStatus("Approve the signature request in your wallet…");

      const timestamp = Math.floor(Date.now() / 1000);
      const signature = await signMintStamp(wallet, event.eventId, timestamp);

      setStatus("Submitting mint transaction via relay…");
      const result = await requestMint({
        recipient: wallet,
        eventId: event.eventId,
        timestamp,
        signature,
      });

      if (!result.txHash || result.blockNumber === undefined) {
        throw new Error("Relay did not return transaction details");
      }

      onSuccess({ txHash: result.txHash, blockNumber: result.blockNumber });
    } catch (err) {
      setStatus(null);
      setError(err instanceof Error ? err.message : "Mint failed");
    } finally {
      setMinting(false);
    }
  }

  const busy = connecting || minting;

  return (
    <div className="flex min-h-screen flex-col px-4 pb-8 pt-10">
      <button
        type="button"
        onClick={onBack}
        disabled={busy}
        className="mb-6 self-start text-sm text-white/60 hover:text-white disabled:opacity-50"
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
            <p className="mt-1 font-mono text-sm" title={wallet}>
              {shortAddress(wallet)}
            </p>
          </div>
        )}

        {status && (
          <p className="mt-4 rounded-xl border border-monad-purple/30 bg-monad-purple/10 px-4 py-3 text-sm text-monad-glow">
            {status}
          </p>
        )}

        {error && (
          <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        )}

        {relayOk === false && (
          <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            Relay is not ready on the server. The organizer must set{" "}
            <span className="font-mono">RELAYER_PRIVATE_KEY</span> and{" "}
            <span className="font-mono">CONTRACT_ADDRESS</span> in Vercel
            environment variables.
          </p>
        )}

        <div className="mt-8 space-y-3">
          {!wallet && (
            <button
              type="button"
              onClick={handleConnect}
              disabled={busy}
              className="w-full rounded-xl border border-white/20 py-3 font-semibold transition hover:bg-white/5 disabled:opacity-50"
            >
              {connecting ? "Connecting…" : "Connect Wallet"}
            </button>
          )}
          <button
            type="button"
            onClick={handleMint}
            disabled={busy || !wallet || relayOk === false}
            className="w-full rounded-xl bg-monad-purple py-4 text-lg font-bold shadow-lg shadow-monad-purple/30 transition hover:bg-monad-purple/90 disabled:opacity-50"
          >
            {minting ? "Minting…" : "Mint your stamp"}
          </button>
        </div>
      </div>
    </div>
  );
}
