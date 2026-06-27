import { useEffect, useState } from "react";
import { EventPayload } from "../lib/qr";
import {
  connectWallet,
  getConnectedAddress,
  isWalletInstalled,
  signMintStamp,
  startWalletDiscovery,
} from "../lib/wallet";
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
  const [walletInstalled, setWalletInstalled] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [minting, setMinting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [relayWarning, setRelayWarning] = useState<string | null>(null);

  useEffect(() => {
    startWalletDiscovery();

    const detectWallet = () => {
      setWalletInstalled(isWalletInstalled());
    };
    detectWallet();

    const redetectTimer = setTimeout(detectWallet, 500);

    getConnectedAddress()
      .then((address) => {
        if (address) {
          setWallet(address);
        }
      })
      .catch(() => undefined);

    let cancelled = false;
    checkRelayHealth()
      .then((health) => {
        if (cancelled) return;
        if (!health.ok) {
          setRelayWarning(
            health.error ??
              "Relay sunucusu hazır değil. Mint için Vercel ortam değişkenleri gerekli."
          );
        }
      })
      .catch(() => {
        if (cancelled) return;
        setRelayWarning("Relay sunucusuna ulaşılamıyor.");
      });

    const ethereum = window.ethereum as
      | (typeof window.ethereum & {
          on?: (event: string, handler: (accounts: string[]) => void) => void;
          removeListener?: (
            event: string,
            handler: (accounts: string[]) => void
          ) => void;
        })
      | undefined;
    if (!ethereum) {
      return () => {
        cancelled = true;
        clearTimeout(redetectTimer);
      };
    }

    const onAccountsChanged = (accounts: string[]) => {
      setWallet(accounts[0] ?? null);
      setError(null);
    };

    ethereum.on?.("accountsChanged", onAccountsChanged);

    return () => {
      cancelled = true;
      clearTimeout(redetectTimer);
      ethereum.removeListener?.("accountsChanged", onAccountsChanged);
    };
  }, []);

  async function handleConnect() {
    if (!isWalletInstalled()) {
      setError(
        "MetaMask bulunamadı. Tarayıcıda MetaMask eklentisini kurun, etkinleştirin ve sayfayı yenileyin."
      );
      return;
    }

    try {
      setConnecting(true);
      setError(null);
      setStatus(
        "MetaMask penceresini onaylayın (tarayıcı adres çubuğunun yanındaki tilki simgesine bakın)…"
      );
      const address = await connectWallet();
      setWallet(address);
      setStatus(null);
    } catch (err) {
      setStatus(null);
      const message =
        err instanceof Error ? err.message : "Cüzdan bağlantısı başarısız";
      if (message.toLowerCase().includes("reject")) {
        setError("Bağlantı reddedildi. Connect Wallet'a tekrar tıklayıp onaylayın.");
      } else {
        setError(message);
      }
    } finally {
      setConnecting(false);
    }
  }

  async function handleMint() {
    if (!wallet) {
      setError("Önce cüzdanınızı bağlayın.");
      return;
    }

    try {
      setMinting(true);
      setError(null);
      setStatus("MetaMask'ta imza isteğini onaylayın…");

      const timestamp = Math.floor(Date.now() / 1000);
      const signature = await signMintStamp(wallet, event.eventId, timestamp);

      setStatus("Mint işlemi relay üzerinden gönderiliyor…");
      const result = await requestMint({
        recipient: wallet,
        eventId: event.eventId,
        timestamp,
        signature,
      });

      if (!result.txHash || result.blockNumber === undefined) {
        throw new Error("Relay işlem detayı döndürmedi");
      }

      onSuccess({ txHash: result.txHash, blockNumber: result.blockNumber });
    } catch (err) {
      setStatus(null);
      setError(err instanceof Error ? err.message : "Mint başarısız");
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

        {!walletInstalled && (
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            MetaMask algılanmadı.{" "}
            <a
              href="https://metamask.io/download/"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              MetaMask kurun
            </a>{" "}
            ve sayfayı yenileyin.
          </div>
        )}

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

        {relayWarning && (
          <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {relayWarning}
          </p>
        )}

        <div className="mt-8 space-y-3">
          {!wallet && (
            <button
              type="button"
              onClick={() => void handleConnect()}
              disabled={connecting}
              className="w-full rounded-xl border border-white/20 py-3 font-semibold transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {connecting ? "Bağlanıyor…" : "Connect Wallet"}
            </button>
          )}
          <button
            type="button"
            onClick={() => void handleMint()}
            disabled={minting || !wallet}
            className="w-full rounded-xl bg-monad-purple py-4 text-lg font-bold shadow-lg shadow-monad-purple/30 transition hover:bg-monad-purple/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {minting ? "Minting…" : "Mint your stamp"}
          </button>
        </div>
      </div>
    </div>
  );
}
