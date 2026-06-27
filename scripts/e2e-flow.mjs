/**
 * MonadStamp end-to-end flow test.
 * Run: node scripts/e2e-flow.mjs
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium, devices } = require("../frontend/node_modules/playwright");
const { ethers } = require("../frontend/node_modules/ethers");
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const FRONTEND = "http://localhost:5173";
const RELAY = "http://localhost:3001";
const EVENT_ID_STR = "monad-blitz-ankara-2026";
const EVENT_NAME = "Monad Blitz Ankara";
const CHAIN_ID = 10143;

const results = [];
function pass(step, detail) {
  results.push({ step, status: "PASS", detail });
  console.log(`✓ Step ${step}: ${detail}`);
}
function fail(step, error) {
  results.push({ step, status: "FAIL", error });
  console.error(`✗ Step ${step} FAILED: ${error}`);
}

async function checkPreconditions() {
  const dep = JSON.parse(
    fs.readFileSync(path.join(ROOT, "deployments/monadTestnet.json"), "utf8")
  );
  if (!dep.contractAddress) throw new Error("No contractAddress in deployment file");

  const health = await fetch(`${RELAY}/health`).then((r) => r.json());
  if (!health.ok) throw new Error(`Relay /health not ok: ${JSON.stringify(health)}`);

  const envText = fs.readFileSync(path.join(ROOT, "frontend/.env"), "utf8");
  const viteEventId = envText.match(/VITE_EVENT_ID=(.+)/)?.[1]?.trim();
  const computedId = ethers.id(EVENT_ID_STR);
  if (viteEventId?.toLowerCase() !== computedId.toLowerCase()) {
    throw new Error(`VITE_EVENT_ID mismatch: env=${viteEventId} computed=${computedId}`);
  }

  const provider = new ethers.JsonRpcProvider("https://testnet-rpc.monad.xyz", CHAIN_ID);
  const abi = JSON.parse(
    fs.readFileSync(
      path.join(ROOT, "artifacts/contracts/MonadStamp.sol/MonadStamp.json"),
      "utf8"
    )
  ).abi;
  const contract = new ethers.Contract(dep.contractAddress, abi, provider);
  const info = await contract.events(computedId);
  const now = Math.floor(Date.now() / 1000);
  if (!info.exists) throw new Error("On-chain event does not exist");
  if (now < Number(info.startTime) || now > Number(info.endTime)) {
    throw new Error("On-chain event is not active");
  }

  return { dep, contract, provider, computedId };
}

async function main() {
  console.log("=== MonadStamp E2E Test ===\n");

  let ctx;
  try {
    const pre = await checkPreconditions();
    pass("pre", `Contract ${pre.dep.contractAddress}, relay ok, event active, VITE_EVENT_ID matches`);

    const testWallet = ethers.Wallet.createRandom();
    const qrPayload = JSON.stringify({ eventId: EVENT_ID_STR, eventName: EVENT_NAME });
    const outDir = path.join(ROOT, "scripts", ".e2e-output");
    fs.mkdirSync(outDir, { recursive: true });

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Step 1: Admin QR
    try {
      await page.goto(`${FRONTEND}/admin`, { waitUntil: "networkidle" });
      await page.fill('input[placeholder="monad-blitz-ankara"]', EVENT_ID_STR);
      await page.fill('input[placeholder="Monad Blitz Ankara"]', EVENT_NAME);
      await page.click('button:has-text("Generate QR Code")');
      await page.waitForSelector("img[alt*='QR code']");
      const payloadText = await page.locator(".font-mono.text-xs").textContent();
      if (payloadText?.trim() !== qrPayload) {
        throw new Error(`QR payload mismatch: got ${payloadText}`);
      }
      const imgSrc = await page.locator("img[alt*='QR code']").getAttribute("src");
      if (!imgSrc?.startsWith("data:image/png")) throw new Error("QR image not PNG data URL");
      const pngPath = path.join(outDir, `monadstamp-${EVENT_ID_STR}.png`);
      fs.writeFileSync(pngPath, Buffer.from(imgSrc.split(",")[1], "base64"));
      pass(1, `QR generated and saved to ${pngPath}`);
    } catch (e) {
      fail(1, e.message);
    }

    // Step 2: Dashboard initial state
    const dashPage = await context.newPage();
    try {
      await dashPage.goto(`${FRONTEND}/dashboard`, { waitUntil: "networkidle" });
      await dashPage.waitForSelector('text=Live', { timeout: 15000 });
      const countText = await dashPage.locator("text=Total Stamps").locator("..").locator(".text-4xl").textContent();
      const count = Number(countText?.trim() ?? "NaN");
      if (count !== 0) {
        throw new Error(`Expected mint count 0, got ${count}`);
      }
      pass(2, "Dashboard live, Total Stamps = 0");
    } catch (e) {
      fail(2, e.message);
    }

    // Steps 3-6: Mobile attendee flow with mocked MetaMask
    const mobile = await browser.newContext({
      ...devices["iPhone 13"],
    });
    await mobile.addInitScript(
      ({ addr, chainId }) => {
        window.ethereum = {
          isMetaMask: true,
          request: async ({ method, params }) => {
            if (method === "eth_chainId") return chainId;
            if (method === "eth_requestAccounts" || method === "eth_accounts") return [addr];
            if (method === "wallet_switchEthereumChain" || method === "wallet_addEthereumChain") return null;
            if (method === "eth_signTypedData_v4") {
              return window.__signTypedData(params[1]);
            }
            throw new Error("Unsupported method: " + method);
          },
          on: () => {},
          removeListener: () => {},
        };
      },
      { addr: testWallet.address, chainId: "0x" + CHAIN_ID.toString(16) }
    );
    const mobilePage = await mobile.newPage();
    await mobilePage.exposeFunction("__signTypedData", async (typedDataJson) => {
      const parsed = JSON.parse(typedDataJson);
      return testWallet.signTypedData(
        parsed.domain,
        { MintStamp: parsed.types.MintStamp },
        parsed.message
      );
    });
    let txHash = null;

    try {
      await mobilePage.goto(`${FRONTEND}/`, { waitUntil: "networkidle" });
      await mobilePage.click('text=Enter QR data manually (dev)');
      await mobilePage.fill("textarea", qrPayload);
      await mobilePage.click('button:has-text("Continue")');
      await mobilePage.waitForSelector(`text=${EVENT_NAME}`);

      await mobilePage.click('button:has-text("Connect Wallet")');
      await mobilePage.waitForSelector(`text=${testWallet.address}`);

      const mintResponsePromise = mobilePage.waitForResponse(
        (r) => r.url().includes("/mint") && r.request().method() === "POST",
        { timeout: 60000 }
      );

      await mobilePage.click('button:has-text("Mint your stamp")');
      const mintResponse = await mintResponsePromise;
      const mintBody = await mintResponse.json();
      if (!mintBody.success) throw new Error(mintBody.error ?? "Relay mint failed");
      txHash = mintBody.txHash;

      await mobilePage.waitForSelector("text=You're checked in!", { timeout: 60000 });
      const successTx = await mobilePage.locator('a[href*="monadexplorer"]').first().getAttribute("href");
      if (!successTx?.includes(txHash)) {
        throw new Error(`Success screen tx mismatch: ${successTx} vs ${txHash}`);
      }
      pass(3, "Mobile flow: manual QR entry (scan equivalent)");
      pass(4, `MetaMask mock connected on chainId ${CHAIN_ID}`);
      pass(5, `Relay mint ok, txHash ${txHash}`);
      pass(6, `Success screen shows txHash, explorer link present`);
    } catch (e) {
      const msg = e.message;
      if (!results.some((r) => r.step === 3)) fail(3, msg);
      else if (!results.some((r) => r.step === 4)) fail(4, msg);
      else if (!results.some((r) => r.step === 5)) fail(5, msg);
      else if (!results.some((r) => r.step === 6)) fail(6, msg);
    }

    // Verify on explorer (RPC receipt)
    if (txHash) {
      try {
        const receipt = await pre.provider.getTransactionReceipt(txHash);
        if (!receipt || receipt.status !== 1) throw new Error("Tx not confirmed or reverted");
        const iface = new ethers.Interface(
          JSON.parse(
            fs.readFileSync(
              path.join(ROOT, "artifacts/contracts/MonadStamp.sol/MonadStamp.json"),
              "utf8"
            )
          ).abi
        );
        const stampLog = receipt.logs
          .map((log) => {
            try {
              return iface.parseLog(log);
            } catch {
              return null;
            }
          })
          .find((p) => p?.name === "StampMinted");
        if (!stampLog) throw new Error("StampMinted event not in receipt");
        pass("6b", `StampMinted on-chain: tokenId ${stampLog.args.tokenId}, recipient ${stampLog.args.recipient}`);
      } catch (e) {
        fail("6b", `Explorer verification: ${e.message}`);
      }
    }

    // Step 7: Dashboard updates
    try {
      await dashPage.waitForFunction(
        () => {
          const el = document.querySelector(".text-4xl.font-bold.text-monad-glow");
          return el && el.textContent?.trim() === "1";
        },
        { timeout: 30000 }
      );
      const feedText = await dashPage.locator(".animate-fade-in").first().textContent();
      if (!feedText?.includes(testWallet.address.slice(0, 6))) {
        throw new Error(`Feed missing recipient: ${feedText}`);
      }
      pass(7, "Dashboard updated in real time, Total Stamps = 1");
    } catch (e) {
      fail(7, e.message);
    }

    await browser.close();

    console.log("\n=== Summary ===");
    for (const r of results) {
      console.log(`  [${r.status}] Step ${r.step}: ${r.detail ?? r.error}`);
    }
    const failed = results.filter((r) => r.status === "FAIL");
    process.exit(failed.length ? 1 : 0);
  } catch (e) {
    console.error("Precondition or fatal error:", e.message);
    process.exit(1);
  }
}

main();
