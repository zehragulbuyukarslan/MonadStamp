import type { VercelRequest, VercelResponse } from "@vercel/node";
import { MintRequestBody, processMint } from "../relay/relay";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const result = await processMint(req.body as MintRequestBody);
    return res.status(result.status).json(result.body);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown relay error";
    return res.status(500).json({ success: false, error: message });
  }
}
