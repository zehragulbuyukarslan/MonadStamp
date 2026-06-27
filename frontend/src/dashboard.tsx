import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { EventLog } from "ethers";
import { CONTRACT_ADDRESS, EXPLORER_URL } from "./lib/config";
import { getMonadStampContract, getReadProvider, shortAddress } from "./lib/contract";

interface FeedItem {
  id: string;
  recipient: string;
  eventName: string;
  blockNumber: number;
  txHash: string;
}

export default function Dashboard() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [status, setStatus] = useState<"loading" | "live" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const eventNameCache = useRef(new Map<string, string>());

  useEffect(() => {
    if (!CONTRACT_ADDRESS) {
      setStatus("error");
      setError("Set VITE_CONTRACT_ADDRESS in frontend/.env");
      return;
    }

    const provider = getReadProvider();
    const contract = getMonadStampContract(provider);
    let mounted = true;

    async function resolveEventName(eventId: string): Promise<string> {
      const cached = eventNameCache.current.get(eventId);
      if (cached) return cached;

      try {
        const info = await contract.events(eventId);
        const name =
          typeof info.name === "string" && info.name.length > 0
            ? info.name
            : "Unknown Event";
        eventNameCache.current.set(eventId, name);
        return name;
      } catch {
        return "Unknown Event";
      }
    }

    async function logToFeedItem(log: EventLog): Promise<FeedItem | null> {
      const parsed = contract.interface.parseLog({
        topics: log.topics as string[],
        data: log.data,
      });
      if (!parsed || parsed.name !== "StampMinted") return null;

      const eventId = parsed.args.eventId as string;
      const recipient = parsed.args.recipient as string;

      return {
        id: `${log.transactionHash}-${log.index}`,
        recipient,
        eventName: await resolveEventName(eventId),
        blockNumber: log.blockNumber,
        txHash: log.transactionHash,
      };
    }

    async function loadHistory() {
      const latest = await provider.getBlockNumber();
      const fromBlock = Math.max(0, latest - 100);
      const logs = (await contract.queryFilter(
        contract.filters.StampMinted(),
        fromBlock,
        latest
      )) as EventLog[];

      const feedItems = await Promise.all(logs.map(logToFeedItem));
      const valid = feedItems.filter((item): item is FeedItem => item !== null);

      valid.sort((a, b) => b.blockNumber - a.blockNumber);

      if (mounted) {
        setItems(valid);
        setStatus("live");
      }
    }

    async function bootstrap() {
      try {
        await loadHistory();
      } catch (err) {
        if (!mounted) return;
        setStatus("error");
        setError(err instanceof Error ? err.message : "Failed to connect");
      }
    }

    bootstrap();

    const onStampMinted = async (
      eventId: string,
      recipient: string,
      _tokenId: bigint,
      event: { log: EventLog }
    ) => {
      if (!mounted) return;

      const eventName = await resolveEventName(eventId);
      const blockNumber = event.log.blockNumber;
      const txHash = event.log.transactionHash;
      const id = `${txHash}-${event.log.index}`;

      const entry: FeedItem = {
        id,
        recipient,
        eventName,
        blockNumber,
        txHash,
      };

      setItems((prev) => {
        if (prev.some((item) => item.id === id)) return prev;
        return [entry, ...prev];
      });
    };

    contract.on("StampMinted", onStampMinted);

    return () => {
      mounted = false;
      contract.off("StampMinted", onStampMinted);
    };
  }, []);

  return (
    <div className="min-h-screen px-6 py-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-10 flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-monad-glow">
              MonadStamp Live
            </p>
            <h1 className="mt-2 text-4xl font-bold md:text-5xl">
              Demo Dashboard
            </h1>
            <p className="mt-2 text-white/60">
              Real-time attendance stamps on Monad Testnet
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-center">
              <p className="text-xs uppercase tracking-wide text-white/50">
                Total Stamps
              </p>
              <p className="mt-1 text-4xl font-bold text-monad-glow">
                {items.length}
              </p>
            </div>
            <div
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm ${
                status === "live"
                  ? "bg-green-500/10 text-green-300"
                  : status === "loading"
                    ? "bg-yellow-500/10 text-yellow-200"
                    : "bg-red-500/10 text-red-200"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  status === "live"
                    ? "animate-pulse bg-green-400"
                    : status === "loading"
                      ? "bg-yellow-400"
                      : "bg-red-400"
                }`}
              />
              {status === "live"
                ? "Live"
                : status === "loading"
                  ? "Connecting…"
                  : "Offline"}
            </div>
          </div>
        </header>

        {error && (
          <p className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-200">
            {error}
          </p>
        )}

        <div className="space-y-3">
          {items.length === 0 && status === "live" && (
            <p className="rounded-2xl border border-dashed border-white/20 px-6 py-16 text-center text-lg text-white/50">
              Waiting for the first stamp… scan a QR code to mint!
            </p>
          )}

          {items.map((item, index) => (
            <div
              key={item.id}
              className={`animate-fade-in rounded-2xl border border-white/10 bg-white/5 px-6 py-5 transition ${
                index === 0 ? "border-monad-purple/40 shadow-lg shadow-monad-purple/10" : ""
              }`}
            >
              <p className="text-lg md:text-2xl">
                <span className="font-mono text-monad-glow">
                  {shortAddress(item.recipient)}
                </span>{" "}
                just got stamped at{" "}
                <strong className="text-white">{item.eventName}</strong>
                <span className="text-white/50"> — Block #{item.blockNumber}</span>
              </p>
              <a
                href={`${EXPLORER_URL}/tx/${item.txHash}`}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-sm text-monad-glow/80 hover:text-monad-glow"
              >
                View transaction →
              </a>
            </div>
          ))}
        </div>

        <footer className="mt-10 flex gap-6 text-sm text-white/40">
          <Link to="/" className="hover:text-white">
            Attendee app
          </Link>
          <Link to="/admin" className="hover:text-white">
            QR generator
          </Link>
        </footer>
      </div>
    </div>
  );
}
