# MH-DOC-008: `funding` and `partially_deployed` phases appear in OpenAPI but are omitted from human status docs and agent context

Severity: Low / Documentation blocker

## Summary

The public API can return `phase: "funding"`, and OpenAPI includes both `funding` and `partially_deployed` in the phase enum. The human `GET /transfers/{id}` docs and the Agentic Integration agent context omit both phases from their phase lists. Agents that rely on the human docs may treat valid API phases as unknown states.

## What I Built Or Used

- Existing TypeScript audit workspace in `/home/DejiTech/multihopper`.
- Official docs snapshot fetched from `https://dev-docs.multihopper.com`.
- Direct safe devnet API checks.
- No private key was loaded for this finding.
- No Solana transaction was signed or broadcast.

## Affected Flow

- `GET /transfers/{id}` status monitoring.
- Agent state-machine parsing.
- Error handling around funding/keeper funding confirmation.

## Steps To Reproduce

1. Create a devnet transfer.
2. Call `/prepare`.
3. Call `/confirm-broadcast` with a bogus keeper funding signature.
4. Fetch the transfer.
5. Observe `phase: "funding"`.
6. Compare the human docs and agent context phase lists with OpenAPI.

## Evidence

Safe API check:

```text
transfer id: 910
confirm bogus keeper signature: 404 MH_036
GET /transfers/910:
status: awaiting_signature
phase: funding
progress.hopsCompleted: 0
progress.hopsTotal: 6
```

Docs evidence:

- `reports/private/docs/openapi.json:150` includes `funding` in the phase enum.
- `reports/private/docs/openapi.json:150` also includes `partially_deployed` in the phase enum.
- `reports/private/docs/api-reference/transfers/get.md:27-29` lists phases but omits `funding` and `partially_deployed`.
- `reports/private/docs/guides/agentic-integration.md:503-505` lists phases for the agent context but omits `funding` and `partially_deployed`.

## Expected Result

All public phase lists should include every phase an API client can receive, including `funding` and `partially_deployed`.

## Actual Result

OpenAPI includes `funding` and `partially_deployed`, but the human docs and agent context omit them.

## Impact

Agent impact:

- Strict agent state machines may classify `funding` or `partially_deployed` as unknown.
- Recovery/retry logic may not know whether to keep waiting, re-prepare, or surface an error.
- This is especially relevant around keeper funding and failed/invalid `confirm-broadcast` attempts.

## Proposed Fix

Update human docs and agent context:

```markdown
phase: quoted -> funding -> deploying -> partially_deployed -> executing -> settled
       (failure: failed | recoverable | rescued | reclaimed | expired)
```

Also explain what `funding` and `partially_deployed` mean and which actions are valid in those phases.

## Contact

TBD
