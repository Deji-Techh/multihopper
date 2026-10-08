# MH-DOC-006: `externalId` duplicate behavior is underdocumented for same-body vs conflicting-body retries

Severity: Low / Documentation blocker

## Summary

The Create Transfer docs say `externalId` is idempotent and the same `externalId` returns the existing transfer. The API introduction and create response example also document `MH_033` as duplicate `externalId`. The actual devnet behavior is more nuanced: a duplicate with the same transfer parameters returns the existing transfer with 200, while a duplicate with different transfer parameters returns `409 MH_033`.

That behavior is reasonable, but the docs do not clearly distinguish safe idempotent retry from conflicting retry. Agents need that distinction to decide whether to resume an existing transfer or surface a conflict.

## What I Built Or Used

- TypeScript audit harness in `/home/DejiTech/multihopper`.
- MultiHopper devnet API with test-mode key.
- Script: `npm run audit:api-behavior`.
- No private key was loaded.
- No Solana transaction was signed or broadcast.

## Affected Flow

- `POST /transfers`
- Agent retries after interrupted create calls.
- `externalId` idempotency.

## Steps To Reproduce

1. Create a transfer with a unique `externalId`.
2. Send `POST /transfers` again with the same `externalId` and identical body.
3. Observe that the API returns the same transfer ID with 200.
4. Send `POST /transfers` with the same `externalId` but a changed amount.
5. Observe that the API returns `409 MH_033`.

## Evidence

Behavior probe:

```text
externalId first create:
id: 903
externalId: behavior-1783278249190-external
status: quote

externalId duplicate create with new idempotency:
id: 903
note: firstId=903 duplicateId=903

externalId duplicate create with conflicting body:
status: 409
error.code: MH_033
message: externalId already exists with different transfer parameters
```

Docs evidence:

- Create Transfer docs say the same `externalId` returns the existing transfer.
- API Introduction lists `MH_033` as duplicate `externalId`.
- The Create Transfer response example shows a duplicate `externalId` 409, without explaining that identical-body retries return the existing transfer.

## Expected Result

Docs should explicitly describe both cases:

- Same `externalId` + same parameters: return existing transfer.
- Same `externalId` + different parameters: `409 MH_033`.

## Actual Result

The docs mention both idempotent return and duplicate error, but do not clearly explain the difference. An agent implementer could incorrectly handle all duplicates as errors or all duplicates as safe resumes.

## Impact

This can cause agent retry bugs:

- An agent may abort a safe retry because it expects all duplicates to be `MH_033`.
- An agent may assume a duplicate always means safe resume and fail to handle parameter conflicts.

## Proposed Fix

Update Create Transfer docs:

```markdown
externalId is idempotent only when the transfer parameters match the original request.

- Same externalId and same parameters: returns the existing transfer.
- Same externalId and different parameters: returns 409 MH_033.
```

Include both response examples.

## Contact

TBD
