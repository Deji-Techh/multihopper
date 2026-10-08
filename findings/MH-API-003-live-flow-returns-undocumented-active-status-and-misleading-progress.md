# MH-API-003: Live devnet flow returns undocumented `active` status and misleading progress/signature fields

Severity: Medium

## Summary

A full devnet transfer flow was executed using the documented agentic sequence: create, prepare, sign/broadcast keeper funding first, intermediate `confirm-broadcast`, broadcast route/orchestrator/session init transactions in order, final `confirm-broadcast`, then monitor.

All five client-broadcast transactions finalized on Solana devnet, and a later `/prepare` call reported `nothingToDo: true`, confirming route/orchestrator/session deployment was complete. However, the API returned `status: "active"` after final confirm, even though `active` is not documented in the status enum. It also reported `progress.hopsTotal: 5` for a transfer created with `hops: 3`, and the `signatures` object exposed only one route init signature while omitting other finalized client-broadcast signatures.

This creates an API-contract problem for agents that implement the documented state machine strictly.

## What I Built Or Used

- TypeScript audit harness in `/home/DejiTech/multihopper`.
- MultiHopper devnet API with test-mode key.
- Solana devnet RPC: `https://api.devnet.solana.com`.
- Source/recipient test wallet: `GrbnzU4RZmMC8AfYBJDx7s2WkARxpJev5t8SCn5WUKjw`.
- Amount: `0.1 SOL`.
- Transfer ID: `908`.
- External ID: `live-devnet-1783278956`.

## Affected Flow

- Full agentic transfer lifecycle.
- `POST /transfers/{id}/confirm-broadcast`.
- `GET /transfers/{id}` monitoring.
- `GET /transfers?status=...` filtering.
- `/prepare` resume diagnostics after deployment.

## Steps To Reproduce

1. Fund a devnet wallet.
2. Run the guarded live devnet runner:

```bash
MULTIHOPPER_BASE_URL=https://devnet.multihopper.com/api/v1 \
SOLANA_RPC_URL=https://api.devnet.solana.com \
SOLANA_KEYPAIR_PATH=/home/DejiTech/.config/solana/id.json \
ALLOW_LIVE_BROADCAST=true \
APPROVED_TEST_WALLET=true \
RECIPIENT_WALLET=GrbnzU4RZmMC8AfYBJDx7s2WkARxpJev5t8SCn5WUKjw \
TOKEN_MINT=So11111111111111111111111111111111111111112 \
AMOUNT_RAW=100000000 \
AMOUNT_TOKENS=0.1 \
HOPS=3 \
ARRIVAL_SECONDS=180 \
npm run audit:live-devnet
```

3. Observe final `confirm-broadcast` response.
4. Poll `GET /transfers/908`.
5. Confirm all client-broadcast signatures on Solana devnet.
6. Re-call `/prepare` for transfer `908`.

## Evidence

Create response:

```text
transfer id: 908
hops: 3
arrivalSeconds: 180
status: quote
isTest: true
```

Prepared bundle and broadcast order:

```text
keeperFundingTx -> routeInitTxs[0] -> routeInitTxs[1] -> orchestratorInitTx -> sessionInitTxs[0]
```

Client-broadcast signatures:

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

All five signatures were confirmed as `Finalized` using `solana confirm --url https://api.devnet.solana.com`.

Final confirm response:

```text
POST /transfers/908/confirm-broadcast
status: active
```

`GET /transfers/908` after final confirm and after the 180-second arrival window:

```text
checkedAt: 2026-07-05T19:24:11Z
createdAt: 2026-07-05T19:16:12.026Z
arrivalSeconds: 180
status: active
phase: executing
progress.hopsCompleted: 0
progress.hopsTotal: 5
signatures.routeInit: [
  "3WizpuouNXqkqeWWkovLwmMtk7ppsbW2X9W2oKbxzpTQvfEuJn8MBFP7ij2TTrb9buNrW2pSk5wTDpaeyVrgF9Cm"
]
signatures.sessionInit: []
signatures.hops: []
lastError: null
recovery: null
```

This status snapshot was about 8 minutes after creation and more than 5 minutes after the target arrival window.

Re-prepare diagnostics:

```text
POST /transfers/908/prepare
keeperFundingTx: null
routeInitTxs: []
orchestratorInitTx: null
sessionInitTxs: []
resume.routeAlreadyDeployed: true
resume.existingHopCount: 3
resume.totalHops: 3
resume.orchestratorAlreadyInitialized: true
resume.completedStepIndices: [0, 1, 2, 3, 4]
resume.totalSteps: 5
resume.keeperAlreadyFunded: true
resume.nothingToDo: true
```

List filter evidence:

```text
GET /transfers?status=active&limit=3
HTTP 200
pagination.total: 1
items[0].id: 908
items[0].status: active
items[0].phase: executing
```

Documented status filters still omit `active`:

```text
OpenAPI GET /transfers status query enum:
quote | awaiting_signature | processing | completed | failed | expired | refunded
```

Docs evidence:

- `reports/private/docs/api-reference/transfers/get.md:23-25` lists statuses as `quote | awaiting_signature | processing | completed | failed | expired | refunded`.
- `reports/private/docs/openapi.json:101-105` has the same status enum and does not include `active`.
- `reports/private/docs/openapi.json` also omits `active` from the `GET /transfers` status filter enum, even though the live API accepts `status=active` and returns active transfers.
- `reports/private/docs/api-reference/transfers/confirm-broadcast.md:9` says once the full bundle is recorded the transfer advances to `processing`.
- `reports/private/docs/guides/agentic-integration.md:503` documents `quote -> awaiting_signature -> processing -> completed | failed | expired | refunded`.

## Expected Result

After final `confirm-broadcast`, API responses should follow the documented contract:

- Status should be a documented enum value, likely `processing` until terminal settlement.
- `progress.hopsTotal` should either match route hop count (`3`) or be renamed/documented as total execution steps (`5`).
- `signatures` should either include all recorded client-broadcast signatures or be clearly documented as a partial/subset view.

## Actual Result

- API returns undocumented `status: "active"`.
- `GET /transfers?status=active` accepts and returns this undocumented status even though OpenAPI does not allow it.
- `progress.hopsTotal` returns `5` while the requested route had `hops: 3`.
- `signatures.routeInit` contains only one of two finalized route init signatures.
- `signatures.sessionInit` is empty despite a finalized session init transaction.
- Keeper funding and orchestrator init signatures are not exposed in `GET /transfers/{id}`.

## Impact

Agent impact:

- Strict OpenAPI-generated clients may reject `active` as an invalid enum value.
- Generated clients may not allow `status=active` as a list filter even though active transfers exist and are filterable.
- Agents following the docs may not know whether `active` is equivalent to `processing`, `executing`, or a different state.
- Progress displays can overstate total hops and make routes look stalled or longer than configured.
- Signature summaries cannot be used reliably as evidence of what was broadcast or confirmed.

Operational impact:

- A transfer can appear in an undocumented non-terminal state with no hop progress and no actionable `lastError` or `recovery` object.
- This weakens status monitoring and incident handling for agentic workflows.

## Proposed Fix

Choose one of these paths:

1. If `active` is intentional:
   - Add `active` to OpenAPI and all docs.
   - Explain how agents should treat it relative to `processing` and `phase: executing`.

2. If `active` is internal:
   - Map it to documented `processing` in public API responses.

Also:

- Clarify whether `progress.hopsTotal` means route hops or total step accounts.
- Rename it if it means total execution steps.
- Include all client-broadcast signatures in `GET /transfers/{id}` or document the `signatures` object as partial.
- Add a regression test that final confirm never returns a status outside OpenAPI enum.

## Contact

TBD
