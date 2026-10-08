# MH-API-005: Idempotency cache replays responses across different actions for the same transfer

Severity: High

## Summary

The idempotency cache can replay a response from one transfer action when the same `Idempotency-Key` is reused on a different action for the same transfer. On devnet transfer `908`, a response from `POST /transfers/908/prepare` was replayed by `POST /transfers/908/rescue/prepare`, returning a normal `preparedTxs` bundle instead of a rescue bundle. In reverse order, a response from `POST /transfers/908/rescue/prepare` was replayed by `POST /transfers/908/prepare`, returning `rescueTxs` instead of `preparedTxs`.

This means idempotency appears to be scoped too broadly across actions with equivalent empty bodies. For agentic workflows, that can make a recovery tool return deployment data, or a deployment tool return rescue data.

## What I Built Or Used

- Direct devnet API checks using the approved test key.
- Existing transfer `908`.
- No private key was loaded.
- No transaction was signed or broadcast.
- No rescue or reclaim transaction was executed.

## Affected Flow

- `POST /transfers/{id}/prepare`
- `POST /transfers/{id}/rescue/prepare`
- Potentially any same-transfer POST mutations with identical or empty request bodies.
- Agent retry/idempotency logic.
- Agent tool dispatch for transfer preparation and recovery.

## Steps To Reproduce

### Case A: Prepare response is replayed by rescue prepare

1. Call `POST /transfers/908/prepare` with an idempotency key.
2. Call `POST /transfers/908/rescue/prepare` with the same idempotency key.
3. Observe that the rescue endpoint returns the cached prepare response shape.

Commands, with secrets omitted:

```bash
curl -sS -X POST \
  "https://devnet.multihopper.com/api/v1/transfers/908/prepare" \
  -H "Accept: application/json" \
  -H "x-api-key: $MULTIHOPPER_API_KEY" \
  -H "Idempotency-Key: cross-scope-prepare-first-20260705"

curl -sS -X POST \
  "https://devnet.multihopper.com/api/v1/transfers/908/rescue/prepare" \
  -H "Accept: application/json" \
  -H "x-api-key: $MULTIHOPPER_API_KEY" \
  -H "Idempotency-Key: cross-scope-prepare-first-20260705"
```

### Case B: Rescue response is replayed by prepare

1. Call `POST /transfers/908/rescue/prepare` with a fresh idempotency key.
2. Call `POST /transfers/908/prepare` with the same idempotency key.
3. Observe that the prepare endpoint returns the cached rescue response shape.

Commands, with secrets omitted:

```bash
curl -sS -X POST \
  "https://devnet.multihopper.com/api/v1/transfers/908/rescue/prepare" \
  -H "Accept: application/json" \
  -H "x-api-key: $MULTIHOPPER_API_KEY" \
  -H "Idempotency-Key: cross-scope-rescue-first-20260705"

curl -sS -X POST \
  "https://devnet.multihopper.com/api/v1/transfers/908/prepare" \
  -H "Accept: application/json" \
  -H "x-api-key: $MULTIHOPPER_API_KEY" \
  -H "Idempotency-Key: cross-scope-rescue-first-20260705"
```

## Evidence

### Case A Result

First request:

```text
POST /transfers/908/prepare
HTTP 200
response keys: ["preparedTxs", "transfer"]
preparedTxs.resume.nothingToDo: true
preparedTxs.resume.routeAlreadyDeployed: true
```

Second request with the same key:

```text
POST /transfers/908/rescue/prepare
HTTP 200
response keys: ["preparedTxs", "transfer"]
hasRescueTxs: false
hasPreparedTxs: true
rescuable: null
```

Expected rescue response keys should include `rescueTxs`, `recentBlockhash`, `lastValidBlockHeight`, and `rescuable`, not `preparedTxs`.

### Case B Result

First request:

```text
POST /transfers/908/rescue/prepare
HTTP 200
response keys: ["lastValidBlockHeight", "recentBlockhash", "rescuable", "rescueTxs"]
rescueTxCount: 1
rescuable.totalLamports: 111316960
```

Second request with the same key:

```text
POST /transfers/908/prepare
HTTP 200
response keys: ["lastValidBlockHeight", "recentBlockhash", "rescuable", "rescueTxs"]
hasRescueTxs: true
hasPreparedTxs: false
transferStatus: null
```

Expected prepare response keys should include `transfer` and `preparedTxs`, not `rescueTxs`.

### Control

Reusing a key across different transfer IDs did not replay the response:

```text
POST /transfers/908/prepare with key cross-transfer-908-first-20260705
HTTP 200

POST /transfers/910/prepare with the same key
HTTP 409
error.code: MH_071
message: Idempotency-Key reused with a different request body
```

This suggests the idempotency comparison likely includes transfer ID or route parameters, but not the specific action/endpoint after the transfer ID.

## Expected Result

Idempotency records should be scoped to the specific mutation action. Reusing a key on a different endpoint should either:

- be treated as a different idempotency namespace, or
- return `409 MH_071` because the method/path/action differs.

`/prepare` should never return a rescue response, and `/rescue/prepare` should never return a normal transfer preparation response.

## Actual Result

For the same transfer and same idempotency key:

- `/rescue/prepare` can return a cached `/prepare` response.
- `/prepare` can return a cached `/rescue/prepare` response.
- Both responses return HTTP 200 even though the response schema does not match the requested endpoint.

## Impact

Agent impact:

- Agents that accidentally reuse one idempotency key per transfer, rather than one per action, can receive the wrong transaction bundle type.
- A rescue tool may conclude there is no rescue bundle because it received `preparedTxs`.
- A normal prepare tool may receive `rescueTxs` and crash, or a loose agent may sign and broadcast recovery transactions while it believes it is preparing the transfer route.
- Generated clients can fail at runtime because the response schema does not match the OpenAPI operation.

Reliability and fund-safety impact:

- Automated recovery and resume paths become unsafe under idempotency-key reuse.
- Wrong cached responses can block recovery of locked funds or cause an agent to take the wrong transaction-signing branch.
- The failure mode is especially relevant to the bounty scope because idempotency, duplicate submissions, conflicting retries, and agentic recovery are listed testing areas.

## Proposed Fix

- Include HTTP method, canonical route template, action name, transfer ID, and normalized request body in the idempotency fingerprint.
- At minimum, reject same-key reuse when the endpoint/action differs, returning `409 MH_071`.
- Store and validate the expected response schema/action for each idempotency record before replaying it.
- Add regression tests:
  - `/prepare` then `/rescue/prepare` with the same key must not replay `/prepare`.
  - `/rescue/prepare` then `/prepare` with the same key must not replay `/rescue/prepare`.
  - Different transfer IDs and different actions should produce clear, documented behavior.

## Contact

TBD
