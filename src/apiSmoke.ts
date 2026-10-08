import { assertBountySafeConfig, loadConfig } from "./config.js";
import { MultiHopperApiError, MultiHopperClient } from "./http.js";
import { redactObject } from "./redact.js";

async function main(): Promise<void> {
  const config = loadConfig();
  assertBountySafeConfig(config, "http");

  if (!config.apiKey) {
    throw new Error("MULTIHOPPER_API_KEY is required for API smoke checks.");
  }

  const client = new MultiHopperClient(config);
  let failed = false;

  async function step(label: string, fn: () => Promise<unknown>): Promise<void> {
    console.log(label);
    try {
      const response = await fn();
      console.log(JSON.stringify(redactObject(response), null, 2));
    } catch (error) {
      failed = true;
      if (error instanceof MultiHopperApiError) {
        console.error(error.message);
        console.error(JSON.stringify(redactObject(error.body), null, 2));
      } else {
        console.error(error instanceof Error ? error.message : error);
      }
    }
  }

  await step("GET /usage", () => client.request<unknown>("GET", "/usage"));
  await step("GET /transfers", () => client.request<unknown>("GET", "/transfers?limit=1"));

  if (failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
