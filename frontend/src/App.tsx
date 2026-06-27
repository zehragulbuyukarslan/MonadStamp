import { useCallback, useState } from "react";
import { ScanScreen } from "./components/ScanScreen";
import { SignScreen, MintResult } from "./components/SignScreen";
import { SuccessScreen } from "./components/SuccessScreen";
import { EventPayload } from "./lib/qr";

type Step = "scan" | "sign" | "success";

function App() {
  const [step, setStep] = useState<Step>("scan");
  const [event, setEvent] = useState<EventPayload | null>(null);
  const [mintResult, setMintResult] = useState<MintResult | null>(null);

  const handleScan = useCallback((payload: EventPayload) => {
    setEvent(payload);
    setStep("sign");
  }, []);

  function handleSuccess(result: MintResult) {
    setMintResult(result);
    setStep("success");
  }

  function handleReset() {
    setEvent(null);
    setMintResult(null);
    setStep("scan");
  }

  if (step === "success" && event && mintResult) {
    return (
      <SuccessScreen
        eventName={event.eventName}
        result={mintResult}
        onReset={handleReset}
      />
    );
  }

  if (step === "sign" && event) {
    return (
      <SignScreen
        event={event}
        onSuccess={handleSuccess}
        onBack={() => setStep("scan")}
      />
    );
  }

  return <ScanScreen onScan={handleScan} />;
}

export default App;
