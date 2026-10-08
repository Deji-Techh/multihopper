# MH-DOC-004: Create transfer initial status is documented inconsistently as `quote` and `awaiting_signature`

Severity: Documentation blocker

## Summary

The Create Transfer API reference and OpenAPI schema say a newly created transfer starts in `quote` status. The Quickstart and Agentic Integration context say the create response has status `awaiting_signature`. A create-only devnet probe confirmed the actual create response returned `status: "quote"`, and a prepare-only probe then returned the same transfer as `awaiting_signature`. Agents that wait for `awaiting_signature` before calling `/prepare` can stall even though `/prepare` is the step that moves the transfer there.

## What I Built Or Used

- TypeScript audit harness in `/home/DejiTech/multihopper`.
- Official docs snapshot fetched from `https://dev-docs.multihopper.com`.
- Read-only smoke check plus a single create-only devnet probe.
- A prepare-only probe was performed after create to confirm the transition.
- No signing or broadcast was performed for this finding.

## Affected Flow

- `POST /transfers`
- Agent state-machine logic between create and prepare.

## Steps To Reproduce

1. Open `https://dev-docs.multihopper.com/api-reference/transfers/create`.
2. Observe that the API reference says initial status is `quote`.
3. Open `https://dev-docs.multihopper.com/quickstart`.
4. Observe that Quickstart says create returns `awaiting_signature`.
5. Open `https://dev-docs.multihopper.com/guides/agentic-integration`.
6. Observe that the agent context says create returns `awaiting_signature`.
7. Run a create-only probe against devnet with a test API key.
8. Run a prepare-only probe for the created transfer.

## Evidence

Local docs snapshot line references:

- `reports/private/docs/api-reference/transfers/create.md:9` says create returns `quote` status.
- `reports/private/docs/api-reference/transfers/create.md:82` says status is initially `quote`.
- `reports/private/docs/api-reference/transfers/create.md:126` response example shows `"status": "quote"`.
- `reports/private/docs/quickstart.md:93` says the create response has status `awaiting_signature`.
- `reports/private/docs/guides/agentic-integration.md:455` says create returns `{ id, status: "awaiting_signature", ... }`.

Create-only devnet probe:

```text
POST /transfers
externalId: create-probe-1783277337473
response id: 898
isTest: true
status: quote
createdAt: 2026-07-05T18:49:11.902Z
```

Prepare-only devnet probe:

```text
POST /transfers/898/prepare
transfer.status: awaiting_signature
preparedTxs.keeperFundingTx: base64(292 chars)
preparedTxs.routeInitTxs: 2 entries
preparedTxs.orchestratorInitTx: base64(444 chars)
preparedTxs.sessionInitTxs: 2 entries
resume.nothingToDo: false
```

No transaction was signed or broadcast for these probes.

## Expected Result

Docs should define the status transition consistently:

- `POST /transfers` returns `quote`.
- `POST /transfers/{id}/prepare` moves or returns the transfer as `awaiting_signature`.
- Agents should call `/prepare` immediately after a successful create response.

## Actual Result

Different docs teach different initial statuses:

- API reference/OpenAPI: `quote`
- Quickstart/agent context: `awaiting_signature`
- Actual create response: `quote`
- Actual prepare response for the created transfer: `awaiting_signature`

## Impact

This affects agentic state machines. A cautious agent may implement:

```typescript
if (transfer.status !== "awaiting_signature") wait();
```

With actual `quote` create responses, that agent never calls `/prepare`, which is the action that returns the transfer as `awaiting_signature`.

## Proposed Fix

Update Quickstart and Agentic Integration context:

```markdown
POST /transfers
-> returns { id, status: "quote", ... }

POST /transfers/{id}/prepare
-> returns { transfer: { status: "awaiting_signature", ... }, preparedTxs }

Call /prepare immediately after a successful create response.
```

If the intended lifecycle is actually `awaiting_signature`, then the API behavior and OpenAPI examples should be changed to return that status consistently.

## Contact

TBD
