import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { parseEventQr, EventPayload } from "../lib/qr";

interface ScanScreenProps {
  onScan: (event: EventPayload) => void;
}

export function ScanScreen({ onScan }: ScanScreenProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState(false);
  const [manualJson, setManualJson] = useState(
    '{"eventId":"demo-event","eventName":"Monad Blitz Ankara"}'
  );

  useEffect(() => {
    if (manualInput) {
      return;
    }

    const scannerId = "qr-reader";
    const scanner = new Html5Qrcode(scannerId);
    scannerRef.current = scanner;
    let handled = false;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decoded) => {
          if (handled) return;
          try {
            const event = parseEventQr(decoded);
            handled = true;
            scanner.stop().catch(() => undefined);
            onScan(event);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Invalid QR code");
          }
        },
        () => undefined
      )
      .catch((err) => {
        setError(
          err instanceof Error
            ? err.message
            : "Camera access denied or unavailable"
        );
      });

    return () => {
      scannerRef.current?.stop().catch(() => undefined);
      scannerRef.current?.clear();
    };
  }, [manualInput, onScan]);

  function handleManualSubmit() {
    try {
      setError(null);
      onScan(parseEventQr(manualJson));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid JSON");
    }
  }

  return (
    <div className="flex min-h-screen flex-col px-4 pb-8 pt-10">
      <header className="mb-8 text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-monad-glow">
          MonadStamp
        </p>
        <h1 className="mt-2 text-3xl font-bold">Scan Event QR</h1>
        <p className="mt-2 text-sm text-white/70">
          Point your camera at the organizer&apos;s QR code to check in.
        </p>
      </header>

      {!manualInput ? (
        <div className="mx-auto w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-black/30 shadow-lg shadow-monad-purple/20">
          <div id="qr-reader" className="w-full" />
        </div>
      ) : (
        <div className="mx-auto w-full max-w-sm space-y-3">
          <label className="block text-sm text-white/70">Paste QR JSON</label>
          <textarea
            value={manualJson}
            onChange={(e) => setManualJson(e.target.value)}
            rows={4}
            className="w-full rounded-xl border border-white/10 bg-black/40 p-3 text-sm outline-none focus:border-monad-purple"
          />
          <button
            type="button"
            onClick={handleManualSubmit}
            className="w-full rounded-xl bg-monad-purple py-3 font-semibold transition hover:bg-monad-purple/90"
          >
            Continue
          </button>
        </div>
      )}

      {error && (
        <p className="mx-auto mt-4 max-w-sm rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => {
          setError(null);
          setManualInput((value) => !value);
        }}
        className="mx-auto mt-6 text-sm text-monad-glow underline-offset-4 hover:underline"
      >
        {manualInput ? "Use camera instead" : "Enter QR data manually (dev)"}
      </button>
    </div>
  );
}
