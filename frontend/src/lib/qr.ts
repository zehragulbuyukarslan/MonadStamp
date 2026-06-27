export interface EventPayload {
  eventId: string;
  eventName: string;
}

export function parseEventQr(raw: string): EventPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid QR code — expected JSON with eventId and eventName");
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("eventId" in parsed) ||
    !("eventName" in parsed)
  ) {
    throw new Error("QR code missing eventId or eventName");
  }

  const { eventId, eventName } = parsed as Record<string, unknown>;
  if (typeof eventId !== "string" || typeof eventName !== "string") {
    throw new Error("eventId and eventName must be strings");
  }
  if (!eventId.trim() || !eventName.trim()) {
    throw new Error("eventId and eventName cannot be empty");
  }

  return { eventId: eventId.trim(), eventName: eventName.trim() };
}

export function buildEventQrPayload(eventId: string, eventName: string): string {
  const trimmedId = eventId.trim();
  const trimmedName = eventName.trim();
  if (!trimmedId || !trimmedName) {
    throw new Error("eventId and eventName cannot be empty");
  }
  return JSON.stringify({ eventId: trimmedId, eventName: trimmedName });
}
