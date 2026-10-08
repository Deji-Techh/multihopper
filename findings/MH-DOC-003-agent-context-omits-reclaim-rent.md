# MH-DOC-003: Agent context omits reclaim-rent recovery tools exposed by OpenAPI

Severity: Low / Documentation blocker

## Summary

The API reference and OpenAPI schema expose rent reclaim recovery endpoints, and the transfer status response includes `recovery.canReclaimRent`. The Agentic Integration guide's MCP-compatible tool table includes rescue tools but omits reclaim-rent tools. An agent using the provided context may recover locked funds but fail to reclaim rent from closed step accounts after settlement.

## What I Built Or Used

- TypeScript audit harness in `/home/DejiTech/multihopper`.
- Official docs snapshot fetched from `https://dev-docs.multihopper.com`.
- Reproduction commands: `npm run docs:fetch`, then `npm run docs:check`.

## Affected Flow

- Agent/MCP tool design.
- Post-settlement recovery cleanup.
- `GET /transfers/{id}` recovery metadata.
- `POST /transfers/{id}/reclaim-rent/prepare`
- `POST /transfers/{id}/reclaim-rent/confirm`

## Steps To Reproduce

1. Open `https://dev-docs.multihopper.com/api-reference/transfers/get`.
2. Observe `recovery.canReclaimRent`.
3. Open `https://dev-docs.multihopper.com/api-reference/openapi.json`.
4. Observe the reclaim-rent prepare and confirm endpoints.
5. Open `https://dev-docs.multihopper.com/guides/agentic-integration`.
6. Go to the MCP server integration tool table.
7. Observe that rescue tools are listed but reclaim-rent tools are absent.

## Evidence

Local docs snapshot line references:

- `reports/private/docs/api-reference/transfers/get.md:55-56` documents `recovery.canReclaimRent` and `recovery.reclaimableLamports`.
- `reports/private/docs/openapi.json:986-990` exposes `POST /transfers/{transferId}/reclaim-rent/prepare`.
- `reports/private/docs/openapi.json:1035-1039` exposes `POST /transfers/{transferId}/reclaim-rent/confirm`.
- `reports/private/docs/guides/agentic-integration.md:544-554` lists MCP tools through rescue confirm but does not include reclaim-rent tools.

Docs checker output:

```text
MH-DOC-003: Agent context omits reclaim-rent recovery tools exposed by OpenAPI
Evidence:
- OpenAPI includes reclaim-rent prepare/confirm paths; agentic tool table only lists rescue tools.
```

## Expected Result

The agent context should include both rescue and rent reclaim recovery actions, with clear trigger conditions:

- Rescue when `recovery.canRescue === true`.
- Reclaim rent when `recovery.canReclaimRent === true`.

## Actual Result

The agent context only lists rescue tools. It does not expose the documented reclaim-rent endpoints to MCP-compatible agents.

## Impact

The impact is lower than signing or broadcast-order bugs, but still relevant to automated agents:

- Agents may leave reclaimable rent on-chain after completed transfers.
- Operators relying on the provided context may not discover the cleanup path.
- Post-settlement automation is incomplete compared with the OpenAPI surface.

## Proposed Fix

Add these rows to the MCP-compatible tool table:

```markdown
| `prepare_reclaim_rent` | `POST /api/v1/transfers/:id/reclaim-rent/prepare` |
| `confirm_reclaim_rent` | `POST /api/v1/transfers/:id/reclaim-rent/confirm` |
```

Add recovery logic to the agent context:

```markdown
If recovery.canReclaimRent is true:
  POST /transfers/{id}/reclaim-rent/prepare -> sign txs -> POST /transfers/{id}/reclaim-rent/confirm
```

## Contact

TBD
