import { EXPLORER_URL } from "../lib/config";
import { MintResult } from "./SignScreen";

interface SuccessScreenProps {
  eventName: string;
  result: MintResult;
  onReset: () => void;
}

export function SuccessScreen({
  eventName,
  result,
  onReset,
}: SuccessScreenProps) {
  const explorerUrl = `${EXPLORER_URL}/tx/${result.txHash}`;

  return (
    <div className="flex min-h-screen flex-col items-center px-4 pb-8 pt-12 text-center">
      <div className="relative mb-8 flex h-40 w-40 items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-monad-purple/20 blur-2xl" />
        <div className="animate-stamp relative flex h-32 w-32 items-center justify-center rounded-full border-4 border-monad-purple bg-monad-dark shadow-xl shadow-monad-purple/40">
          <span className="text-4xl">✓</span>
        </div>
      </div>

      <div className="animate-fade-in max-w-sm">
        <p className="text-sm uppercase tracking-[0.2em] text-monad-glow">
          Stamped
        </p>
        <h1 className="mt-2 text-3xl font-bold">You&apos;re checked in!</h1>
        <p className="mt-3 text-white/70">
          Your soul-bound stamp for <strong>{eventName}</strong> is on Monad
          Testnet.
        </p>

        <div className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-left text-sm">
          <div>
            <p className="text-xs uppercase tracking-wide text-white/50">
              Transaction
            </p>
            <p className="mt-1 break-all font-mono">{result.txHash}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-white/50">
              Block
            </p>
            <p className="mt-1 font-mono">#{result.blockNumber}</p>
          </div>
        </div>

        <a
          href={explorerUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-monad-purple py-3 font-semibold transition hover:bg-monad-purple/90"
        >
          View on Explorer
        </a>

        <button
          type="button"
          onClick={onReset}
          className="mt-3 w-full rounded-xl border border-white/20 py-3 text-sm transition hover:bg-white/5"
        >
          Scan another event
        </button>
      </div>
    </div>
  );
}
