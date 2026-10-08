# MH-API-004: Expired/stuck transfer remains `active/executing` while rescue is already actionable

Severity: Medium

## Summary

A live devnet transfer stayed in undocumented `status: "active"` and `phase: "executing"` more than three hours after `expiresAt`, with `progress.hopsCompleted: 0` and `lastError: null`. At the same time, `GET /transfers/{id}` returned `recovery.canRescue: true`, and `POST /transfers/{id}/rescue/prepare` returned a valid rescue transaction bundle. This gives agents contradictory lifecycle signals: keep monitoring an active/executing route, or start rescue.

## What I Built Or Used

- TypeScript audit harness in `/home/DejiTech/multihopper`.
- MultiHopper devnet API with test-mode key.
- Solana devnet RPC: `https://api.devnet.solana.com`.
- Source/recipient test wallet: `GrbnzU4RZmMC8AfYBJDx7s2WkARxpJev5t8SCn5WUKjw`.
- Transfer ID: `908`.
- Amount: `0.1 SOL`.
- No rescue transaction was signed or broadcast for this finding.

## Affected Flow

- Status monitoring after expiry.
- Recovery/rescue decision logic for stalled agentic transfers.
- `GET /transfers/{id}` lifecycle contract.
- `POST /transfers/{id}/rescue/prepare` availability.

## Steps To Reproduce

1. Create a devnet transfer with a short arrival window.
2. Call `/prepare`.
3. Sign and broadcast the prepared bundle in the documented order.
4. Confirm the keeper-funding transaction first, then confirm the remaining route/orchestrator/session signatures.
5. Wait until after `expiresAt`.
6. Call `GET /transfers/{id}`.
7. If `recovery.canRescue` is true, call `POST /transfers/{id}/rescue/prepare` without signing or broadcasting the returned transaction.

## Evidence

Transfer `908` was created at `2026-07-05T19:16:12.026Z` with `arrivalSeconds: 180` and `expiresAt: 2026-07-05T19:46:12.023Z`.

All five client-side initialization transactions were finalized on Solana devnet:

```text
keeperFundingTx:
5eGPJ9YHbA7bZkFGbVkTDZaKKeVDZziuANio4gTYsh6kCxTvnrkrH3eqem8fSxEAtvYkxPmWD5KmdhesDfMbLGHw

routeInitTxs[0]:
3WizpuouNXqkqeWWkovLwmMtk7ppsbW2X9W2oKbxzpTQvfEuJn8MBFP7ij2TTrb9buNrW2pSk5wTDpaeyVrgF9Cm

routeInitTxs[1]:
3hFDmXwTMTPD2ptcuguV92eehwtYMVVdzj4LQ2AURxEYRrJZs9JREEdYC3YiJB1uqWDk5H6Fn3VNoee1sc6vNxX1

orchestratorInitTx:
3V85spAXitrR63GywMnbU5gCJCbtysPCG61kbbAZqypd6awETWCbxdx15zHboXQTsKFm1XvsUq2s6yKWfyeZUmsn

sessionInitTxs[0]:
uvYvAdgCvmaF5zxb9p7XAjrWUcRRsncCsmF1iYY4DwDcutFHJGMxirZB2jEg9HJc56ra1usBiyChaAQx1KiFz7a
```

Post-expiry `GET /transfers/908` at approximately `2026-07-05T23:25Z`, more than three hours after `expiresAt`:

```text
status: active
phase: executing
expiresAt: 2026-07-05T19:46:12.023Z
completedAt: null
progress.hopsCompleted: 0
progress.hopsTotal: 5
lastError: null
recovery.canRescue: true
recovery.rescuableLamports: 111316960
recovery.canReclaimRent: false
```

The recovery object was not only present; it was actionable. `POST /transfers/908/rescue/prepare` returned HTTP 200:

```text
rescueTxCount: 1
rescueTxs[0].base64Chars: 1072
rescueTxs[0].partialSigners: []
rescuable.totalLamports: 111316960
rescuable.accounts:
- orchestrator_config: 1433760
- step_state: 35379161
- step_state: 31244778
- step_state: 31285595
- step_state: 9997026
- step_state: 1976640
```

Additional recovery control:

```text
POST /transfers/908/reclaim-rent/prepare
HTTP 409
error.code: MH_080
error.message: Recovery action not allowed in current phase — phase=active
```

This introduces a third state label for the same transfer: `GET /transfers/908` reports `status: active` and `phase: executing`, while the recovery error message says `phase=active`.

Docs evidence:

- `reports/private/docs/api-reference/transfers/get.md:48-49` says `recovery` is only populated when `phase` is `recoverable`, `settled`, `rescued`, or `reclaimed`.
- The observed API response populated `recovery` while `phase` was `executing`.
- `reports/private/docs/openapi.json:882` says rescue prepare is only available when `recovery.canRescue` is true.
- `reports/private/docs/api-reference/introduction.md` documents `MH_080` as "Recovery action not allowed in current transfer phase", but the API message uses `active` as a phase even though public `GET` returned `phase: "executing"`.

## Expected Result

Once a transfer is past `expiresAt` and rescue is available, the API should expose an unambiguous recovery state. For example:

- `status: "failed"` or `status: "expired"` with `phase: "recoverable"` when rescue can recover locked funds.
- `lastError` explaining why execution stopped.
- `recovery` populated only in the documented recovery phases, or docs updated if recovery can appear during `executing`.

## Actual Result

- `status` remained undocumented `active`.
- `phase` remained `executing`.
- `lastError` remained `null`.
- `recovery.canRescue` was true.
- `rescue/prepare` returned a valid rescue bundle.
- `reclaim-rent/prepare` returned `MH_080` with `phase=active`, which conflicts with the public `phase: "executing"` field.

## Impact

Agent impact:

- Agents following the documented state machine may keep polling because the transfer is still `active/executing`.
- Agents following recovery fields may attempt rescue while the route still appears to be executing.
- Alerting cannot distinguish "still executing" from "stuck and rescuable" without undocumented heuristics.

Fund-safety and reliability impact:

- Funds can remain locked in route/step accounts until a human or agent notices the rescue hint.
- Recovery flows become harder to automate safely because status, phase, error, and recovery fields disagree.

## Proposed Fix

- Transition stuck/expired-but-rescuable transfers into a documented recovery state.
- Populate `lastError` with a structured code and timestamp when the route becomes rescuable.
- Align `status`, `phase`, and `recovery` so an agent has one clear next action.
- Add a regression test for: `expiresAt < now && recovery.canRescue === true` must not return `phase: "executing"` with `lastError: null`.
- If recovery is intentionally allowed during `executing`, document that explicitly and provide agent decision rules.

## Contact

TBD
