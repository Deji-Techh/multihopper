# MH-DOC-011: Estimate docs omit SOL budgeting fields and conflict with live `screeningFeeLamports` output

Severity: Documentation blocker

## Summary

The Estimate Fees documentation tells integrators to use `POST /transfers/estimate` to budget expected costs, but the human docs only document top-level fee fields. Live devnet responses include important nested `tokens` and `sol` budgeting fields, including `requiredSolUpFrontLamports`, `minTransferAmountLamports`, and `sol.breakdown.screeningFeeLamports`. The page also warns that the estimate does not include the compliance screening fee and says to add it on top, while the live response already includes a `screeningFeeLamports` entry.

This can cause agents to under-budget or double-count SOL, directly affecting whether the later `/prepare` and broadcast flow succeeds.

## What I Built Or Used

- Official docs snapshot from `https://dev-docs.multihopper.com`.
- Direct devnet `POST /transfers/estimate` call using the approved test key.
- No transfer was created.
- No private key was loaded.
- No transaction was signed or broadcast.

## Affected Flow

- Preflight estimation.
- Wallet SOL budgeting before `/prepare`.
- Agent decision-making around whether the source wallet can safely proceed.

## Steps To Reproduce

1. Read `reports/private/docs/api-reference/transfers/estimate.md`.
2. Observe the warning that the estimate does not include the compliance screening fee.
3. Observe that the human response field list only documents top-level fee fields.
4. Call `POST /transfers/estimate` on devnet.
5. Observe the nested `tokens` and `sol` response fields, including `screeningFeeLamports`.
6. Compare the live response with the human docs and OpenAPI.

## Evidence

Human docs warning:

```text
reports/private/docs/api-reference/transfers/estimate.md:11-17
This estimate does not include the compliance screening fee...
Add it on top of the fees returned here...
```

Human docs response fields:

```text
reports/private/docs/api-reference/transfers/estimate.md:38-74
Documents only:
tier, percentFeeBps, percentFeeRaw, flatFeeLamportsPerHop,
totalFlatFeeLamports, integratorPercentShare, integratorFlatShare,
usdEquivalent, isTestMode.
```

Quickstart estimate example:

```text
reports/private/docs/quickstart.md
Shows only:
tier, percentFeeBps, totalFlatFeeLamports, usdEquivalent.
```

Live devnet response:

```text
POST /transfers/estimate
HTTP 200
isTestMode: true
tokens.amountRaw: 100000000
tokens.feeRaw: 49975
tokens.netDeliveredRaw: 99950025
sol.requiredSolUpFrontLamports: 168013068
sol.minTransferAmountLamports: 2039280
sol.breakdown.routeInitRentLamports: 21109680
sol.breakdown.orchestratorRentLamports: 18708480
sol.breakdown.ataRentLamports: 3326880
sol.breakdown.transactionFeesLamports: 45000
sol.breakdown.priorityFeesLamports: 0
sol.breakdown.protocolFlatFeeLamports: 0
sol.breakdown.screeningFeeLamports: 2000000
sol.refundableLamports: 22035360
sol.netCostLamports: 145977708
```

OpenAPI partially documents `tokens` and `sol`, but the `sol.breakdown` schema omits `screeningFeeLamports`, and it does not include `minTransferAmountLamports`.

## Expected Result

The estimate docs should give agents one clear budgeting contract:

- whether the screening deposit is included in estimate responses,
- whether inclusion differs by environment,
- full response documentation for `tokens`,
- full response documentation for `sol.requiredSolUpFrontLamports`,
- full response documentation for every `sol.breakdown` field,
- whether agents should add any extra lamports on top before signing prepared bundles.

## Actual Result

- Human docs say the estimate does not include the screening fee.
- Live devnet estimate includes `screeningFeeLamports`.
- Human docs omit the nested `tokens` and `sol` fields.
- OpenAPI omits some live nested fields.
- Quickstart shows only a minimal estimate response.

## Impact

Agent impact:

- Agents may add the screening deposit again and overestimate required SOL.
- Agents may ignore `requiredSolUpFrontLamports` because it is not in the human docs and fail later during broadcast due to insufficient lamports.
- Agents cannot reliably decide whether to request a devnet airdrop or stop before attempting a transfer.

Reliability impact:

- SOL budgeting is part of the bounty's agentic transfer flow because signing and broadcasting stay client-side.
- Incorrect preflight budget guidance leads to failed prepared transactions and poor recovery behavior.

## Proposed Fix

- Update the Estimate Fees page and Quickstart examples to show the full response shape.
- Add `sol.breakdown.screeningFeeLamports` and `sol.minTransferAmountLamports` to OpenAPI if they are intentional.
- Clarify: "The estimate includes `screeningFeeLamports` when returned; do not add it again" or remove the field if the warning is correct.
- State environment-specific behavior for devnet vs mainnet.

## Contact

TBD
