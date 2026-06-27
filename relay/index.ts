import express from "express";
import cors from "cors";
import * as dotenv from "dotenv";
import {
  getHealthResponse,
  getRelayContext,
  MintRequestBody,
  processMint,
} from "./relay";

dotenv.config();

const DEFAULT_PORT = 3001;

async function main() {
  await getRelayContext();

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/health", async (_req, res) => {
    try {
      res.json(await getHealthResponse());
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown relay error";
      res.status(500).json({ success: false, error: message });
    }
  });

  app.post("/mint", async (req, res) => {
    try {
      const result = await processMint(req.body as MintRequestBody);
      res.status(result.status).json(result.body);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown relay error";
      res.status(500).json({ success: false, error: message });
    }
  });

  const port = Number(process.env.PORT ?? DEFAULT_PORT);
  app.listen(port, () => {
    console.log(`MonadStamp relay listening on http://localhost:${port}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
