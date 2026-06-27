import { useState } from "react";
import { Link } from "react-router-dom";
import QRCode from "qrcode";
import { buildEventQrPayload } from "./lib/qr";

export default function Admin() {
  const [eventId, setEventId] = useState("monad-blitz-ankara-2026");
  const [eventName, setEventName] = useState("Monad Blitz Ankara");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [payload, setPayload] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    try {
      setError(null);
      const json = buildEventQrPayload(eventId, eventName);
      setPayload(json);
      const dataUrl = await QRCode.toDataURL(json, {
        width: 512,
        margin: 2,
        color: { dark: "#0D0221", light: "#FFFFFF" },
      });
      setQrDataUrl(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate QR");
    }
  }

  function handleDownload() {
    if (!qrDataUrl) return;
    const anchor = document.createElement("a");
    anchor.href = qrDataUrl;
    anchor.download = `monadstamp-${eventId.replace(/\s+/g, "-")}.png`;
    anchor.click();
  }

  return (
    <div className="flex min-h-screen flex-col px-4 pb-8 pt-10">
      <header className="mx-auto mb-8 w-full max-w-md">
        <Link
          to="/"
          className="text-sm text-white/60 transition hover:text-white"
        >
          ← Attendee app
        </Link>
        <p className="mt-4 text-sm uppercase tracking-[0.2em] text-monad-glow">
          Organizer
        </p>
        <h1 className="mt-2 text-3xl font-bold">Event QR Generator</h1>
        <p className="mt-2 text-sm text-white/70">
          Create a QR code for attendees to scan at check-in.
        </p>
      </header>

      <div className="mx-auto w-full max-w-md space-y-4">
        <div>
          <label className="mb-1 block text-sm text-white/70">Event ID</label>
          <input
            type="text"
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            placeholder="monad-blitz-ankara-2026"
            className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 outline-none focus:border-monad-purple"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-white/70">Event Name</label>
          <input
            type="text"
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
            placeholder="Monad Blitz Ankara"
            className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 outline-none focus:border-monad-purple"
          />
        </div>

        {error && (
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleGenerate}
          className="w-full rounded-xl bg-monad-purple py-3 font-semibold shadow-lg shadow-monad-purple/30 transition hover:bg-monad-purple/90"
        >
          Generate QR Code
        </button>

        {qrDataUrl && (
          <div className="animate-fade-in space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
            <img
              src={qrDataUrl}
              alt={`QR code for ${eventName}`}
              className="mx-auto rounded-xl bg-white p-3"
            />
            <p className="text-sm font-semibold">{eventName}</p>
            <p className="break-all font-mono text-xs text-white/50">
              {payload}
            </p>
            <button
              type="button"
              onClick={handleDownload}
              className="w-full rounded-xl border border-monad-purple/50 py-3 font-semibold transition hover:bg-monad-purple/10"
            >
              Download PNG
            </button>
          </div>
        )}

        <Link
          to="/dashboard"
          className="block text-center text-sm text-monad-glow underline-offset-4 hover:underline"
        >
          Open live demo dashboard →
        </Link>
      </div>
    </div>
  );
}
