import { assertBountySafeConfig, loadConfig } from "./config.js";
import { MultiHopperClient } from "./http.js";
import { redactObject } from "./redact.js";
import type { PreparedTxBundle } from "./types.js";

interface PrepareResponse {
  transfer: unknown;
  preparedTxs: PreparedTxBundle;
}

function summarizeBase64(value: string | null | undefined): string | null {
  if (!value) return null;
  return `base64(${value.length} chars)`;
}

function summarizePreparedTxs(preparedTxs: PreparedTxBundle): Record<string, unknown> {
  return {
    keeperFundingTx: summarizeBase64(preparedTxs.keeperFundingTx),
    routeInitTxs: preparedTxs.routeInitTxs
      ? preparedTxs.routeInitTxs.map((entry) => summarizeBase64(typeof entry === "string" ? entry : entry.base64))
      : preparedTxs.routeInitTxs,
    orchestratorInitTx: summarizeBase64(preparedTxs.orchestratorInitTx),
    sessionInitTxs: preparedTxs.sessionInitTxs
      ? preparedTxs.sessionInitTxs.map((entry) => summarizeBase64(entry))
      : preparedTxs.sessionInitTxs,
    recentBlockhash: preparedTxs.recentBlockhash,
    lastValidBlockHeight: preparedTxs.lastValidBlockHeight,
    resume: preparedTxs.resume,
  };
}

async function main(): Promise<void> {
  const config = loadConfig();
  assertBountySafeConfig(config, "http");

  if (!config.apiKey) throw new Error("MULTIHOPPER_API_KEY is required.");
  const transferId = process.env.TRANSFER_ID;
  if (!transferId) throw new Error("TRANSFER_ID is required.");

  const client = new MultiHopperClient(config);
  const response = await client.request<PrepareResponse>("POST", `/transfers/${transferId}/prepare`);

  console.log(JSON.stringify(redactObject({ transfer: response.transfer }), null, 2));
  console.log(JSON.stringify(summarizePreparedTxs(response.preparedTxs), null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
