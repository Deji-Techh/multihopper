import { readFileSync } from "node:fs";
import { Connection, Keypair } from "@solana/web3.js";
import { buildBroadcastPlan, buildIntermediateConfirmBody, validateFinalSignatures } from "./broadcastPlan.js";
import { assertBountySafeConfig, loadConfig } from "./config.js";
import { MultiHopperClient } from "./http.js";
import { redactObject } from "./redact.js";
import { signPreparedTxs } from "./tx.js";
import type { BroadcastSignatures, PreparedTxBundle } from "./types.js";

interface PrepareResponse {
  transfer: unknown;
  preparedTxs: PreparedTxBundle;
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function optionalNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`${name} must be a number.`);
  return value;
}

function loadKeypair(path: string): Keypair {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
  if (!Array.isArray(parsed) || !parsed.every((item) => Number.isInteger(item))) {
    throw new Error(`Invalid Solana keypair file: ${path}`);
  }
  return Keypair.fromSecretKey(Uint8Array.from(parsed as number[]));
}

function transferIdFromResponse(response: unknown): number {
  const record = response as { id?: unknown; transfer?: { id?: unknown } };
  const id = typeof record.id === "number" ? record.id : record.transfer?.id;
  if (typeof id !== "number") {
    throw new Error(`Unable to read transfer id from response: ${JSON.stringify(redactObject(response))}`);
  }
  return id;
}

function transferFromResponse(response: unknown): Record<string, unknown> {
  const record = response as { transfer?: Record<string, unknown> };
  return record.transfer ?? (response as Record<string, unknown>);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function broadcastAndConfirm(
  connection: Connection,
  base64Tx: string,
  label: string,
  preparedTxs: PreparedTxBundle,
): Promise<string> {
  if (!preparedTxs.recentBlockhash || !preparedTxs.lastValidBlockHeight) {
    throw new Error("Prepared transaction bundle is missing recentBlockhash or lastValidBlockHeight.");
  }

  const raw = Buffer.from(base64Tx, "base64");
  const signature = await connection.sendRawTransaction(raw, {
    maxRetries: 3,
    preflightCommitment: "confirmed",
    skipPreflight: false,
  });

  console.log(`${label}: sent ${signature}`);
  const confirmation = await connection.confirmTransaction(
    {
      signature,
      blockhash: preparedTxs.recentBlockhash,
      lastValidBlockHeight: preparedTxs.lastValidBlockHeight,
    },
    "confirmed",
  );

  if (confirmation.value.err) {
    throw new Error(`${label}: transaction failed: ${JSON.stringify(confirmation.value.err)}`);
  }

  console.log(`${label}: confirmed`);
  return signature;
}

async function main(): Promise<void> {
  const config = loadConfig();
  assertBountySafeConfig(config, "broadcast");

  if (process.env.APPROVED_TEST_WALLET !== "true") {
    throw new Error("APPROVED_TEST_WALLET=true is required before live devnet transfer tests.");
  }

  if (!config.apiKey) throw new Error("MULTIHOPPER_API_KEY is required.");
  if (!config.keypairPath) throw new Error("SOLANA_KEYPAIR_PATH is required.");

  const keypair = loadKeypair(config.keypairPath);
  const sourceOwner = keypair.publicKey.toBase58();
  const client = new MultiHopperClient(config);
  const connection = new Connection(config.rpcUrl, "confirmed");

  const params = {
    tokenMint: requiredEnv("TOKEN_MINT"),
    amountRaw: requiredEnv("AMOUNT_RAW"),
    amountTokens: requiredEnv("AMOUNT_TOKENS"),
    tokenDecimals: optionalNumberEnv("TOKEN_DECIMALS", 9),
    tokenSymbol: process.env.TOKEN_SYMBOL,
    sourceOwner,
    recipientWallet: requiredEnv("RECIPIENT_WALLET"),
    hops: optionalNumberEnv("HOPS", 3),
    arrivalSeconds: optionalNumberEnv("ARRIVAL_SECONDS", 180),
    externalId: process.env.TRANSFER_EXTERNAL_ID || `audit-${Date.now()}`,
  };

  console.log("Creating devnet transfer:");
  console.log(JSON.stringify(redactObject(params), null, 2));
  const created = await client.request<unknown>("POST", "/transfers", params);
  console.log(JSON.stringify(redactObject(created), null, 2));
  const transferId = transferIdFromResponse(created);

  const signatures: BroadcastSignatures = {
    routeInitSignatures: [],
    sessionInitSignatures: [],
  };

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    console.log(`Prepare attempt ${attempt}`);
    const prepared = await client.request<PrepareResponse>("POST", `/transfers/${transferId}/prepare`);
    console.log(JSON.stringify(redactObject({ resume: prepared.preparedTxs.resume }), null, 2));

    if (prepared.preparedTxs.resume?.nothingToDo) break;

    const signed = signPreparedTxs(prepared.preparedTxs, keypair);
    const plan = buildBroadcastPlan(signed);
    console.log(`Broadcast plan: ${plan.map((task) => task.label).join(" -> ")}`);

    for (const [index, task] of plan.entries()) {
      const signature = await broadcastAndConfirm(connection, task.base64, task.label, prepared.preparedTxs);

      if (task.kind === "keeperFundingTx") {
        signatures.keeperFundingSignature = signature;
        await client.request("POST", `/transfers/${transferId}/confirm-broadcast`, buildIntermediateConfirmBody(signature));
        console.log("Recorded keeper funding signature with intermediate confirm-broadcast.");
      } else if (task.kind === "routeInitTx") {
        signatures.routeInitSignatures![task.index!] = signature;
      } else if (task.kind === "orchestratorInitTx") {
        signatures.orchestratorInitSignature = signature;
      } else if (task.kind === "sessionInitTx") {
        signatures.sessionInitSignatures![task.index!] = signature;
      }

      const next = plan[index + 1];
      if (task.kind === "routeInitTx" && next?.kind !== "routeInitTx") {
        await sleep(3000);
      }
      if (task.kind === "orchestratorInitTx") {
        await sleep(3000);
      }
    }

    validateFinalSignatures(prepared.preparedTxs, signatures);
    const confirmed = await client.request("POST", `/transfers/${transferId}/confirm-broadcast`, signatures);
    console.log("Final confirm-broadcast response:");
    console.log(JSON.stringify(redactObject(confirmed), null, 2));
    break;
  }

  for (let poll = 0; poll < 24; poll += 1) {
    const response = await client.request<unknown>("GET", `/transfers/${transferId}`);
    const transfer = transferFromResponse(response);
    console.log(
      `poll=${poll} status=${String(transfer.status)} phase=${String(transfer.phase)} progress=${JSON.stringify(transfer.progress ?? null)}`,
    );
    if (["completed", "failed", "expired", "refunded"].includes(String(transfer.status))) return;
    await sleep(5000);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
