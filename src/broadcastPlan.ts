import type { BroadcastSignatures, PreparedTxBundle } from "./types.js";

export type BroadcastKind =
  | "keeperFundingTx"
  | "routeInitTx"
  | "orchestratorInitTx"
  | "sessionInitTx";

export interface BroadcastTask {
  kind: BroadcastKind;
  label: string;
  index?: number;
  base64: string;
}

function unwrapBase64(entry: { base64: string } | string): string {
  return typeof entry === "string" ? entry : entry.base64;
}

export function buildBroadcastPlan(preparedTxs: PreparedTxBundle): BroadcastTask[] {
  const tasks: BroadcastTask[] = [];

  if (preparedTxs.keeperFundingTx) {
    tasks.push({
      kind: "keeperFundingTx",
      label: "keeperFundingTx",
      base64: preparedTxs.keeperFundingTx,
    });
  }

  for (const [index, entry] of (preparedTxs.routeInitTxs ?? []).entries()) {
    tasks.push({
      kind: "routeInitTx",
      label: `routeInitTxs[${index}]`,
      index,
      base64: unwrapBase64(entry),
    });
  }

  if (preparedTxs.orchestratorInitTx) {
    tasks.push({
      kind: "orchestratorInitTx",
      label: "orchestratorInitTx",
      base64: preparedTxs.orchestratorInitTx,
    });
  }

  for (const [index, base64] of (preparedTxs.sessionInitTxs ?? []).entries()) {
    tasks.push({
      kind: "sessionInitTx",
      label: `sessionInitTxs[${index}]`,
      index,
      base64,
    });
  }

  return tasks;
}

export function buildIntermediateConfirmBody(keeperFundingSignature: string): BroadcastSignatures {
  return {
    routeInitSignatures: [],
    keeperFundingSignature,
  };
}

export function validateFinalSignatures(
  preparedTxs: PreparedTxBundle,
  signatures: BroadcastSignatures,
): void {
  if (preparedTxs.keeperFundingTx && !signatures.keeperFundingSignature) {
    throw new Error("keeperFundingSignature is required because keeperFundingTx was prepared.");
  }

  const routeCount = preparedTxs.routeInitTxs?.length ?? 0;
  if ((signatures.routeInitSignatures?.length ?? 0) !== routeCount) {
    throw new Error(`Expected ${routeCount} routeInitSignatures.`);
  }

  const sessionCount = preparedTxs.sessionInitTxs?.length ?? 0;
  if ((signatures.sessionInitSignatures?.length ?? 0) !== sessionCount) {
    throw new Error(`Expected ${sessionCount} sessionInitSignatures.`);
  }

  if (preparedTxs.orchestratorInitTx && !signatures.orchestratorInitSignature) {
    throw new Error("orchestratorInitSignature is required because orchestratorInitTx was prepared.");
  }
}
