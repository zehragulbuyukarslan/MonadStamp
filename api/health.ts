import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getHealthResponse } from "../relay/relay";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  if (_req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    return res.status(200).json(await getHealthResponse());
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown relay error";
    return res.status(500).json({ success: false, error: message });
  }
}
