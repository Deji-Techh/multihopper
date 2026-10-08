import assert from "node:assert/strict";
import { buildBroadcastPlan, buildIntermediateConfirmBody, validateFinalSignatures } from "./broadcastPlan.js";
import { DEVNET_API_BASE, DEVNET_RPC_URL, SafetyError, assertBountySafeConfig, loadConfig } from "./config.js";
import { verifyDocumentedVersionedSignPreservesServerSignature } from "./tx.js";
import type { BroadcastSignatures, PreparedTxBundle } from "./types.js";

function run(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

run("VersionedTransaction signing preserves existing server partial signature", () => {
  const result = verifyDocumentedVersionedSignPreservesServerSignature();
  assert.equal(result.serverSignaturePreserved, true);
  assert.equal(result.ownerSignatureAdded, true);
  console.log(`  owner=${result.owner}`);
  console.log(`  serverSigner=${result.serverSigner}`);
});

run("broadcast plan enforces documented order", () => {
  const prepared: PreparedTxBundle = {
    keeperFundingTx: "keeper",
    routeInitTxs: [{ base64: "route0" }, { base64: "route1" }],
    orchestratorInitTx: "orchestrator",
    sessionInitTxs: ["session0", "session1"],
  };

  const plan = buildBroadcastPlan(prepared);
  assert.deepEqual(
    plan.map((task) => task.label),
    ["keeperFundingTx", "routeInitTxs[0]", "routeInitTxs[1]", "orchestratorInitTx", "sessionInitTxs[0]", "sessionInitTxs[1]"],
  );
});

run("intermediate confirm body contains only keeper funding signature and empty route signatures", () => {
  assert.deepEqual(buildIntermediateConfirmBody("devnetSig"), {
    routeInitSignatures: [],
    keeperFundingSignature: "devnetSig",
  });
});

run("final signature validation rejects missing keeper funding signature", () => {
  const prepared: PreparedTxBundle = {
    keeperFundingTx: "keeper",
    routeInitTxs: [],
    sessionInitTxs: [],
  };

  assert.throws(
    () => validateFinalSignatures(prepared, { routeInitSignatures: [], sessionInitSignatures: [] }),
    /keeperFundingSignature/,
  );
});

run("final signature validation accepts matching bundle signatures", () => {
  const prepared: PreparedTxBundle = {
    keeperFundingTx: "keeper",
    routeInitTxs: [{ base64: "route0" }],
    orchestratorInitTx: "orchestrator",
    sessionInitTxs: ["session0"],
  };
  const signatures: BroadcastSignatures = {
    keeperFundingSignature: "keeperSig",
    routeInitSignatures: ["routeSig0"],
    orchestratorInitSignature: "orchestratorSig",
    sessionInitSignatures: ["sessionSig0"],
  };

  validateFinalSignatures(prepared, signatures);
});

run("safety gate rejects production API and mainnet RPC", () => {
  assert.throws(
    () =>
      assertBountySafeConfig(
        {
          baseUrl: "https://multihopper.com/api/v1",
          apiKey: "mh_live_placeholder",
          rpcUrl: "https://api.mainnet-beta.solana.com",
          allowLiveBroadcast: true,
          requestTimeoutMs: 20000,
        },
        "broadcast",
      ),
    SafetyError,
  );
});

run("safety gate accepts devnet HTTP checks", () => {
  assertBountySafeConfig(
    {
      baseUrl: DEVNET_API_BASE,
      apiKey: "mh_test_placeholder",
      rpcUrl: DEVNET_RPC_URL,
      allowLiveBroadcast: false,
      requestTimeoutMs: 20000,
    },
    "http",
  );
});

run("current env is safe for HTTP checks", () => {
  const config = loadConfig();
  assertBountySafeConfig(config, "http");
});
