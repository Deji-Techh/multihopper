import { assertBountySafeConfig, loadConfig } from "./config.js";
import { MultiHopperClient } from "./http.js";
import { redactObject } from "./redact.js";

async function main(): Promise<void> {
  const config = loadConfig();
  assertBountySafeConfig(config, "http");

  if (!config.apiKey) throw new Error("MULTIHOPPER_API_KEY is required.");
  const transferId = process.env.TRANSFER_ID;
  if (!transferId) throw new Error("TRANSFER_ID is required.");

  const client = new MultiHopperClient(config);
  const response = await client.request<unknown>("GET", `/transfers/${transferId}`);
  console.log(JSON.stringify(redactObject(response), null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
