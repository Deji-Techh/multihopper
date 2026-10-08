import { randomUUID } from "node:crypto";
import { assertBountySafeConfig, loadConfig } from "./config.js";
import { MultiHopperApiError, MultiHopperClient } from "./http.js";
import { redactObject } from "./redact.js";
import type { PreparedTxBundle } from "./types.js";

interface ProbeRecord {
  name: string;
  ok: boolean;
  status?: number;
  body?: unknown;
  note?: string;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function transferIdFromResponse(response: unknown): number {
  const id = (response as { id?: unknown }).id;
  if (typeof id !== "number") {
    throw new Error(`Unable to read transfer id from response: ${JSON.stringify(redactObject(response))}`);
  }
  return id;
}

function makeBody(sourceOwner: string, externalId: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    tokenMint: process.env.TOKEN_MINT || "So11111111111111111111111111111111111111112",
    amountRaw: process.env.AMOUNT_RAW || "100000000",
    amountTokens: process.env.AMOUNT_TOKENS || "0.1",
    tokenDecimals: Number(process.env.TOKEN_DECIMALS || "9"),
    tokenSymbol: process.env.TOKEN_SYMBOL || "SOL",
    sourceOwner,
    recipientWallet: process.env.RECIPIENT_WALLET || sourceOwner,
    hops: Number(process.env.HOPS || "3"),
    arrivalSeconds: Number(process.env.ARRIVAL_SECONDS || "180"),
    externalId,
    ...overrides,
  };
}

async function capture(name: string, fn: () => Promise<unknown>): Promise<ProbeRecord> {
  try {
    const body = await fn();
    return { name, ok: true, body };
  } catch (error) {
    if (error instanceof MultiHopperApiError) {
      return { name, ok: false, status: error.status, body: error.body };
    }
    throw error;
  }
}

function errorCode(record: ProbeRecord): string | undefined {
  const body = record.body as { error?: { code?: unknown }; code?: unknown };
  const code = body?.error?.code ?? body?.code;
  return typeof code === "string" ? code : undefined;
}

function summarizeRecord(record: ProbeRecord): ProbeRecord {
  return {
    ...record,
    body: redactObject(summarizeBody(record.body)),
  };
}

function skippedRecord(name: string, note: string): ProbeRecord {
  return {
    name,
    ok: false,
    note,
  };
}

function summarizeBase64(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.length > 120 ? `base64(${value.length} chars)` : value;
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

function summarizeBody(body: unknown): unknown {
  if (body && typeof body === "object" && "preparedTxs" in body) {
    const response = body as { transfer?: unknown; preparedTxs?: PreparedTxBundle };
    return {
      transfer: response.transfer,
      preparedTxs: response.preparedTxs ? summarizePreparedTxs(response.preparedTxs) : response.preparedTxs,
    };
  }
  return body;
}

async function main(): Promise<void> {
  const config = loadConfig();
  assertBountySafeConfig(config, "http");
  if (!config.apiKey) throw new Error("MULTIHOPPER_API_KEY is required.");

  const sourceOwner = required("SOURCE_OWNER");
  const client = new MultiHopperClient(config);
  const nonce = `behavior-${Date.now()}`;
  const records: ProbeRecord[] = [];

  const missingIdem = await capture("missing idempotency on create", () =>
    client.request("POST", "/transfers", makeBody(sourceOwner, `${nonce}-missing-idem`), { idempotencyKey: false }),
  );
  missingIdem.note = errorCode(missingIdem) === "MH_070" ? "matched documented MH_070" : "unexpected result";
  records.push(missingIdem);

  const idemKey = `probe.${randomUUID()}`;
  const idemBody = makeBody(sourceOwner, `${nonce}-idem`);
  const first = await capture("idempotency first create", () =>
    client.request("POST", "/transfers", idemBody, { idempotencyKey: idemKey }),
  );
  records.push(first);

  if (first.ok) {
    const replay = await capture("idempotency same key same body", () =>
      client.request("POST", "/transfers", idemBody, { idempotencyKey: idemKey }),
    );
    replay.note = replay.ok ? `firstId=${transferIdFromResponse(first.body)} replayId=${transferIdFromResponse(replay.body)}` : undefined;
    records.push(replay);

    const conflict = await capture("idempotency same key conflicting body", () =>
      client.request(
        "POST",
        "/transfers",
        makeBody(sourceOwner, `${nonce}-idem-conflict`, { amountRaw: "100000001", amountTokens: "0.100000001" }),
        { idempotencyKey: idemKey },
      ),
    );
    conflict.note = errorCode(conflict) === "MH_071" ? "matched documented MH_071" : "unexpected result";
    records.push(conflict);
  } else {
    records.push(skippedRecord("idempotency same key same body", "skipped because first idempotent create failed"));
    records.push(skippedRecord("idempotency same key conflicting body", "skipped because first idempotent create failed"));
  }

  const externalId = `${nonce}-external`;
  const extFirst = await capture("externalId first create", () =>
    client.request("POST", "/transfers", makeBody(sourceOwner, externalId)),
  );
  records.push(extFirst);

  const extDuplicate = await capture("externalId duplicate create with new idempotency", () =>
    client.request("POST", "/transfers", makeBody(sourceOwner, externalId)),
  );
  if (extFirst.ok && extDuplicate.ok) {
    extDuplicate.note = `firstId=${transferIdFromResponse(extFirst.body)} duplicateId=${transferIdFromResponse(extDuplicate.body)}`;
  } else {
    extDuplicate.note = `errorCode=${errorCode(extDuplicate) ?? "unknown"}`;
  }
  records.push(extDuplicate);

  const extConflict = await capture("externalId duplicate create with conflicting body", () =>
    client.request(
      "POST",
      "/transfers",
      makeBody(sourceOwner, externalId, { amountRaw: "100000001", amountTokens: "0.100000001" }),
    ),
  );
  if (extFirst.ok && extConflict.ok) {
    extConflict.note = `firstId=${transferIdFromResponse(extFirst.body)} conflictId=${transferIdFromResponse(extConflict.body)}`;
  } else {
    extConflict.note = `errorCode=${errorCode(extConflict) ?? "unknown"}`;
  }
  records.push(extConflict);

  const confirmExternalId = `${nonce}-confirm`;
  const confirmCreate = await capture("confirm-missing-keeper create", () =>
    client.request("POST", "/transfers", makeBody(sourceOwner, confirmExternalId)),
  );
  records.push(confirmCreate);

  if (confirmCreate.ok) {
    const transferId = transferIdFromResponse(confirmCreate.body);
    const prepare = await capture("confirm-missing-keeper prepare", () =>
      client.request("POST", `/transfers/${transferId}/prepare`),
    );
    records.push(prepare);

    const prepareMissingIdempotency = await capture("prepare missing idempotency", () =>
      client.request("POST", `/transfers/${transferId}/prepare`, undefined, { idempotencyKey: false }),
    );
    prepareMissingIdempotency.note =
      errorCode(prepareMissingIdempotency) === "MH_070" ? "matched documented MH_070" : "unexpected result";
    records.push(prepareMissingIdempotency);

    const confirmMissingIdempotency = await capture("confirm-broadcast missing idempotency", () =>
      client.request(
        "POST",
        `/transfers/${transferId}/confirm-broadcast`,
        {
          routeInitSignatures: [],
        },
        { idempotencyKey: false },
      ),
    );
    confirmMissingIdempotency.note =
      errorCode(confirmMissingIdempotency) === "MH_070" ? "matched documented MH_070" : "unexpected result";
    records.push(confirmMissingIdempotency);

    const missingKeeper = await capture("confirm-broadcast missing keeperFundingSignature", () =>
      client.request("POST", `/transfers/${transferId}/confirm-broadcast`, {
        routeInitSignatures: [],
      }),
    );
    missingKeeper.note = errorCode(missingKeeper) === "MH_039" ? "matched documented MH_039" : "unexpected result";
    records.push(missingKeeper);
  }

  for (const record of records) {
    console.log(`\n## ${record.name}`);
    console.log(JSON.stringify(summarizeRecord(record), null, 2));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
