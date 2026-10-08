# MH-DOC-001: Quickstart copy-paste flow omits required Idempotency-Key headers and hides the intermediate confirm call

Severity: Documentation blocker

## Summary

The Quickstart is the most likely page for an agent or first-time integrator to copy from, but its mutating POST cURL examples omit the required `Idempotency-Key` header. The same page also describes the intermediate keeper-funding confirmation in the overview, then the detailed "Confirm broadcast" step only shows the final all-signatures confirmation body. An automated agent following the detailed blocks can fail with `MH_070` or skip the immediate keeper-funding confirmation that the agentic guide says prevents double funding on resume.

## What I Built Or Used

- TypeScript audit harness in `/home/DejiTech/multihopper`.
- Official docs snapshot fetched from `https://dev-docs.multihopper.com`.
- Reproduction commands: `npm run docs:fetch`, then `npm run docs:check`.

## Affected Flow

- `POST /transfers`
- `POST /transfers/{id}/prepare`
- `POST /transfers/{id}/confirm-broadcast`
- Agentic transfer flow: create, prepare, keeper funding confirm, final confirm.

## Steps To Reproduce

1. Open the Quickstart: `https://dev-docs.multihopper.com/quickstart`.
2. Compare it with API Introduction: `https://dev-docs.multihopper.com/api-reference/introduction`.
3. API Introduction states all POST mutations require `Idempotency-Key`.
4. In Quickstart, copy the Step 2, Step 3, and Step 4 cURL blocks.
5. Observe that none of those mutating POST blocks include `Idempotency-Key`.
6. In Quickstart, compare the flow overview with detailed Step 4.
7. The overview mentions recording `keeperFundingSignature` immediately, but Step 4 only shows a final all-signatures body.

## Evidence

Local docs snapshot line references:

- `reports/private/docs/api-reference/introduction.md:52` says all POST mutations require `Idempotency-Key`.
- `reports/private/docs/api-reference/introduction.md:60` documents `MH_070` for missing or invalid idempotency key.
- `reports/private/docs/quickstart.md:75-90` Step 2 create cURL lacks `Idempotency-Key`.
- `reports/private/docs/quickstart.md:99-102` Step 3 prepare cURL lacks `Idempotency-Key`.
- `reports/private/docs/quickstart.md:125-133` Step 4 confirm cURL lacks `Idempotency-Key`.
- `reports/private/docs/quickstart.md:37-43` overview includes an intermediate keeper-funding confirmation.
- `reports/private/docs/quickstart.md:120-136` detailed Step 4 only shows the final all-signatures confirmation body.

Docs checker output:

```text
MH-DOC-001: Quickstart mutating POST examples omit required Idempotency-Key headers
Evidence:
- Step 2 create transfer
- Step 3 prepare transactions
- Step 4 confirm broadcast

MH-DOC-001B: Quickstart detailed confirm step does not show the intermediate keeper-funding confirm call
Evidence:
- Step 4 shows a final all-signatures confirm body but not the immediate keeper-funding-only body.
```

## Expected Result

The Quickstart should be safe to copy directly into an agentic workflow. Every mutating POST example should include `Idempotency-Key`, and the confirm section should show both confirm calls:

1. Intermediate keeper-funding confirmation with `routeInitSignatures: []`.
2. Final confirmation after all remaining transactions are confirmed.

## Actual Result

The Quickstart cURL blocks omit `Idempotency-Key`. The detailed confirm section compresses the two-call pattern into a single final example, despite the overview and agentic guide saying the immediate keeper-funding call is required for safe resume behavior.

## Impact

This materially affects agent reliability because agents usually follow nearby code blocks over surrounding prose. The failure modes are:

- `POST /transfers`, `/prepare`, or `/confirm-broadcast` can fail with `MH_070`.
- An agent can skip the immediate keeper-funding confirmation.
- If the process crashes after keeper funding and before final confirmation, resume logic can become ambiguous and may reintroduce the double-funding risk the two-step pattern is designed to avoid.

## Proposed Fix

Add `Idempotency-Key` to all mutating POST examples in Quickstart:

```bash
-H "Idempotency-Key: $(uuidgen)" \
```

Split Quickstart Step 4 into two explicit sections:

```bash
# Step 4a: Confirm keeper funding immediately
curl -X POST /api/v1/transfers/42/confirm-broadcast \
  -H "x-api-key: mh_test_abc123..." \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
    "routeInitSignatures": [],
    "keeperFundingSignature": "9vLmXt8w..."
  }'

# Step 4b: Final confirm after remaining transactions are confirmed
curl -X POST /api/v1/transfers/42/confirm-broadcast \
  -H "x-api-key: mh_test_abc123..." \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
    "routeInitSignatures": ["4mGxFn7m..."],
    "orchestratorInitSignature": "2qYzLf1x...",
    "sessionInitSignatures": ["7nKpQr3z..."],
    "keeperFundingSignature": "9vLmXt8w..."
  }'
```

## Contact

TBD
