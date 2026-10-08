import { assertBountySafeConfig, loadConfig } from "./config.js";
import { MultiHopperClient } from "./http.js";
import { redactObject } from "./redact.js";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function numberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`${name} must be numeric.`);
  return value;
}

async function main(): Promise<void> {
  const config = loadConfig();
  assertBountySafeConfig(config, "http");

  if (!config.apiKey) throw new Error("MULTIHOPPER_API_KEY is required.");

  const sourceOwner = required("SOURCE_OWNER");
  const recipientWallet = process.env.RECIPIENT_WALLET || sourceOwner;
  const client = new MultiHopperClient(config);

  const body = {
    tokenMint: process.env.TOKEN_MINT || "So11111111111111111111111111111111111111112",
    amountRaw: process.env.AMOUNT_RAW || "100000000",
    amountTokens: process.env.AMOUNT_TOKENS || "0.1",
    tokenDecimals: numberEnv("TOKEN_DECIMALS", 9),
    tokenSymbol: process.env.TOKEN_SYMBOL || "SOL",
    sourceOwner,
    recipientWallet,
    hops: numberEnv("HOPS", 3),
    arrivalSeconds: numberEnv("ARRIVAL_SECONDS", 180),
    externalId: process.env.TRANSFER_EXTERNAL_ID || `create-probe-${Date.now()}`,
  };

  console.log("POST /transfers create-only probe");
  console.log(JSON.stringify(redactObject(body), null, 2));

  const response = await client.request<unknown>("POST", "/transfers", body);
  console.log(JSON.stringify(redactObject(response), null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
