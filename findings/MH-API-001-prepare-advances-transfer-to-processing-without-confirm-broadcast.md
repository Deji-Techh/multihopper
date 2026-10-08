# MH-API-001: Transfer advances to `processing` without signed broadcasts or `confirm-broadcast`

Severity: High

## Summary

A devnet transfer advanced from `quote`/`awaiting_signature` to `processing` and `phase: "deploying"` after create and prepare probes only. No transaction was signed, no transaction was broadcast, and `POST /confirm-broadcast` was never called. Direct `GET /transfers/898` then showed `processing` with empty signature arrays, while another `/prepare` call still returned a full undeployed bundle with `routeAlreadyDeployed: false`, `keeperAlreadyFunded: false`, and `nothingToDo: false`.

This contradicts the documented state machine, where `processing` should happen only after the client broadcasts the prepared transactions and records signatures through the final `confirm-broadcast`.

The same behavior reproduced on transfer `907`, and again on transfer `910`. Transfer `910` was still reported as `processing/deploying` more than three hours after `expiresAt`, with empty signature arrays and no actionable error.

## What I Built Or Used

- TypeScript audit harness in `/home/DejiTech/multihopper`.
- MultiHopper devnet API with test-mode key.
- Source wallet public key: `GrbnzU4RZmMC8AfYBJDx7s2WkARxpJev5t8SCn5WUKjw`.
- No private key was loaded for this finding.
- No transaction signing or broadcasting was performed.

Relevant scripts:

- `npm run audit:create-probe`
- `npm run audit:prepare-probe`
- `npm run audit:get-transfer`
- `npm run audit:api:smoke`

## Affected Flow

- `POST /transfers`
- `POST /transfers/{id}/prepare`
- `GET /transfers/{id}`
- `GET /transfers`
- Agent status monitoring and resume logic.

## Steps To Reproduce

1. Create a devnet transfer using `POST /transfers`.
2. Do not sign or broadcast anything.
3. Call `POST /transfers/{id}/prepare` once.
4. Do not call `POST /transfers/{id}/confirm-broadcast`.
5. Call `GET /transfers/{id}` or `GET /transfers`.
6. Observe that the transfer is reported as `processing` / `deploying`.
7. Call `POST /transfers/{id}/prepare` again.
8. Observe that the API still returns a full undeployed bundle and resume state says the route, orchestrator, sessions, and keeper funding are not complete.

## Evidence

Create-only probe:

```text
POST /transfers
externalId: create-probe-1783277337473
response id: 898
isTest: true
status: quote
createdAt: 2026-07-05T18:49:11.902Z
```

First prepare-only probe:

```text
POST /transfers/898/prepare
transfer.status: awaiting_signature
preparedTxs.keeperFundingTx: base64(292 chars)
preparedTxs.routeInitTxs: 2 entries
preparedTxs.orchestratorInitTx: base64(444 chars)
preparedTxs.sessionInitTxs: 2 entries
resume.routeAlreadyDeployed: false
resume.orchestratorAlreadyInitialized: false
resume.keeperAlreadyFunded: false
resume.nothingToDo: false
```

Direct transfer fetch after no signing, no broadcast, and no confirm:

```text
GET /transfers/898
checkedAt: 2026-07-05T18:56:25Z
expiresAt: 2026-07-05T19:19:11.901Z
status: processing
phase: deploying
progress.hopsCompleted: 0
progress.hopsTotal: 6
signatures.routeInit: []
signatures.sessionInit: []
signatures.hops: []
recovery: null
lastError: null
```

The transfer had not expired at the time of the status check.

Second prepare-only probe:

```text
POST /transfers/898/prepare
transfer.status: processing
preparedTxs.keeperFundingTx: base64(292 chars)
preparedTxs.routeInitTxs: 2 entries
preparedTxs.orchestratorInitTx: base64(444 chars)
preparedTxs.sessionInitTxs: 2 entries
resume.routeAlreadyDeployed: false
resume.existingHopCount: 0
resume.orchestratorAlreadyInitialized: false
resume.completedStepIndices: []
resume.keeperAlreadyFunded: false
resume.nothingToDo: false
```

Second reproduction:

```text
POST /transfers
response id: 907
status: quote

POST /transfers/907/prepare
transfer.status: awaiting_signature
resume.routeAlreadyDeployed: false
resume.orchestratorAlreadyInitialized: false
resume.keeperAlreadyFunded: false
resume.nothingToDo: false

GET /transfers/907
checkedAt: 2026-07-05T19:06:33Z
expiresAt: 2026-07-05T19:36:03.190Z
status: processing
phase: deploying
signatures.routeInit: []
signatures.sessionInit: []
signatures.hops: []
```

Transfer `907` had not expired at the time of the second status check.

Third reproduction after failed/bogus keeper signature confirm and no real signed broadcasts:

```text
transfer id: 910
createdAt: 2026-07-05T19:27:17.631Z
expiresAt: 2026-07-05T19:57:17.630Z

GET /transfers
checkedAt: 2026-07-05T23:35Z
status: processing
phase: deploying
progress.hopsCompleted: 0
progress.hopsTotal: 6
lastError: null
recovery.canRescue: false
signatures.routeInit: []
signatures.sessionInit: []
signatures.hops: []
```

Transfer `910` was already expired at the time of this status check, yet it still appeared as an active deployment with no signatures, no recovery action, and no error.

Code path verification:

- `src/createQuoteProbe.ts` only calls `POST /transfers`.
- `src/prepareProbe.ts` only calls `POST /transfers/{id}/prepare` and summarizes returned transaction sizes.
- `src/getTransfer.ts` only calls `GET /transfers/{id}`.
- None of those scripts signs, broadcasts, or calls `confirm-broadcast`.

## Expected Result

Before any signed transaction is broadcast and before `confirm-broadcast`, the transfer should remain in a pre-processing state such as `quote` or `awaiting_signature`.

The documented transition to processing should occur only after final confirmation:

1. Client broadcasts `keeperFundingTx`.
2. Client calls intermediate `confirm-broadcast` with `keeperFundingSignature`.
3. Client broadcasts route, orchestrator, and session init transactions.
4. Client calls final `confirm-broadcast` with remaining signatures.
5. API verifies on-chain state/signatures and advances to `processing`.

## Actual Result

The transfer appears as `processing` / `deploying` even though:

- No keeper funding signature exists.
- No route init signatures exist.
- No session init signatures exist.
- The resume state says nothing has been deployed or funded.
- `/prepare` still returns the full bundle.

## Impact

This can break agentic workflows in multiple ways:

- Agents may believe the keeper network has taken over and stop signing/broadcasting.
- Monitoring dashboards or webhooks may report a route as deploying even though no on-chain deployment has started.
- Recovery logic may choose the wrong branch because `phase` says `deploying` while `resume` says all deployment work remains.
- A transfer can appear stuck in processing with no signatures and no actionable error.
- This can persist past `expiresAt`, so timeouts do not reliably correct the state-machine mismatch.

This is especially risky because the documented guide says `processing` is reached after final `confirm-broadcast`, so agents are likely to treat it as a post-client-action state.

## Proposed Fix

State transitions should be gated on recorded and verified client broadcasts:

- `/prepare` may set a clear pre-broadcast state such as `awaiting_signature`, but should not advance to `processing`.
- `processing` should require final `confirm-broadcast` plus verified on-chain route/orchestrator/session state.
- If a transfer is in `processing` with no signatures and no deployed state, the API should either:
  - move it back to `awaiting_signature`, or
  - expose a clear `deploying_pending_client_broadcast` phase distinct from keeper-controlled processing.

Add a regression test:

1. Create transfer.
2. Prepare only.
3. Assert `GET /transfers/{id}` is not `processing`.
4. Assert `processing` occurs only after valid confirm-broadcast state checks pass.

## Contact

TBD
