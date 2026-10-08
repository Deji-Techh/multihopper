# MH-API-011: Expired transfer still returns a fresh prepare transaction bundle

Severity: High

## Summary

Transfer `910` had expired at `2026-07-05T19:57:17.630Z` and remained in `status: "processing"`, `phase: "deploying"` with no route/session/hop signatures. On `2026-07-06T01:13:08+01:00`, more than five hours after expiry, `POST /transfers/910/prepare` still returned HTTP 200 with a fresh prepared transaction bundle and current blockhash data.

An agent resuming an old transfer could sign and broadcast a stale route after the documented expiry time instead of receiving `MH_034 Transfer expired` or a recovery/failure state. This compounds the earlier state-machine bug where prepare-only transfers advance to `processing` without signed broadcasts.

No returned transaction was signed or broadcast.

## What I Built Or Used

- Direct devnet API checks with the approved test key passed through shell headers only.
- Transfer ID `910` from earlier prepare/confirm behavior testing.
- No private key was loaded.
- No transaction was signed or broadcast.

## Affected Flow

- `POST /transfers/{transferId}/prepare`
- Resume behavior after interruption
- Expiry handling
- Agent signing safety

## Steps To Reproduce

1. Create a devnet transfer.
2. Prepare it, but do not complete a valid signed broadcast flow.
3. Wait until after `expiresAt`.
4. Call `GET /transfers/{id}` and confirm it is expired by timestamp.
5. Call `POST /transfers/{id}/prepare` with a fresh idempotency key.
6. Observe that the API returns a fresh prepared transaction bundle instead of `MH_034` or another terminal/recovery response.

## Evidence

Transfer state before the prepare retry:

```text
transfer id: 910
createdAt: 2026-07-05T19:27:17.631Z
expiresAt: 2026-07-05T19:57:17.630Z
status: processing
phase: deploying
signatures.routeInit: []
signatures.sessionInit: []
signatures.hops: []
recovery.canRescue: false
lastError: null
```

Prepare retried after expiry:

```text
checkedAt: 2026-07-06T01:13:08+01:00

POST /transfers/910/prepare
Idempotency-Key: probe.prepare.expired.910.1783296800

HTTP 200
transfer.status: processing
transfer.expiresAt: 2026-07-05T19:57:17.630Z
preparedTxs.keeperFundingTx: present
preparedTxs.routeInitTxs.length: 2
preparedTxs.orchestratorInitTx: present
preparedTxs.sessionInitTxs.length: 2
preparedTxs.resume.routeAlreadyDeployed: false
preparedTxs.resume.existingHopCount: 0
preparedTxs.resume.totalHops: 3
preparedTxs.resume.orchestratorAlreadyInitialized: false
preparedTxs.resume.completedStepIndices: []
preparedTxs.resume.totalSteps: 6
preparedTxs.resume.keeperAlreadyFunded: false
preparedTxs.resume.nothingToDo: false
preparedTxs.recentBlockhash: present
preparedTxs.lastValidBlockHeight: 462101252
```

Control on expired transfer `908`:

```text
POST /transfers/908/prepare
checked after expiresAt: 2026-07-05T19:46:12.023Z

HTTP 200
transfer.status: active
preparedTxs.routeInitTxs.length: 0
preparedTxs.orchestratorInitTx: null
preparedTxs.sessionInitTxs.length: 0
preparedTxs.keeperFundingTx: null
preparedTxs.resume.nothingToDo: true
```

Even when no transactions remain, prepare still returns HTTP 200 after expiry.

## Expected Result

After `expiresAt`, prepare should not hand agents fresh signable transaction bundles for a stale transfer. The API should return one of:

```text
HTTP 410
error.code: MH_034
error.message: Transfer expired
```

or a documented recovery response if funds are already locked and rescue/reclaim is the next safe action.

## Actual Result

- `POST /transfers/910/prepare` returned HTTP 200 after expiry.
- The response included a full fresh bundle with keeper funding, route init, orchestrator init, and session init transactions.
- Resume flags showed nothing had been deployed or funded.
- Status remained `processing/deploying` with no actionable error.

## Impact

Agent impact:

- A resumed agent can sign and broadcast an expired transfer after the intended validity window.
- Agents may spend SOL/rent on a route that should have been terminal or recreated.
- The flow contradicts the documented expiry and lifecycle model.

Reliability and fund-safety impact:

- Expired transfers can keep producing fresh work for clients.
- Stale route deployment may create locked state that then requires rescue or rent reclamation.
- The distinction between "resume safely" and "create a new transfer" becomes unclear.

## Proposed Fix

- Before generating a prepare bundle, check `expiresAt` and terminal/recovery state.
- Return `MH_034` or a documented recovery-state error for expired transfers.
- If post-expiry prepare is intentionally allowed for a grace period, document the grace period and expose it in the transfer response.
- Add regression tests:
  - expired unbroadcast transfer -> `prepare` returns `MH_034`,
  - expired partially deployed transfer -> `prepare` returns only documented recovery guidance,
  - non-expired awaiting-signature transfer -> `prepare` returns signable bundle.

## Contact

TBD
