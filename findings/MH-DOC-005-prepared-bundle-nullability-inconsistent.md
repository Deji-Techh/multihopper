# MH-DOC-005: PreparedTxBundle nullability is inconsistent for resumed route/session arrays

Severity: Documentation blocker

## Summary

The Agentic Integration guide says resumed `/prepare` calls return `null` for any group already confirmed on-chain and shows `routeInitTxs: null`. The Prepare API reference describes `routeInitTxs` and `sessionInitTxs` as arrays, empty or omitted when already done. OpenAPI marks `keeperFundingTx` and `orchestratorInitTx` nullable, but does not mark `routeInitTxs` or `sessionInitTxs` nullable. This creates incompatible generated client types for exactly the resume path agents need to handle safely.

## What I Built Or Used

- TypeScript audit harness in `/home/DejiTech/multihopper`.
- Official docs snapshot fetched from `https://dev-docs.multihopper.com`.
- Reproduction command: `npm run docs:check`.

## Affected Flow

- `POST /transfers/{id}/prepare`
- Resume after partial broadcast, blockhash expiry, RPC failure, or process crash.
- Generated clients using OpenAPI types.

## Steps To Reproduce

1. Open `https://dev-docs.multihopper.com/guides/agentic-integration`.
2. Go to "Handling expiry and resume".
3. Observe the example with `routeInitTxs: null`.
4. Open `https://dev-docs.multihopper.com/api-reference/transfers/prepare`.
5. Observe that `routeInitTxs` and `sessionInitTxs` are documented as arrays.
6. Open `https://dev-docs.multihopper.com/api-reference/openapi.json`.
7. Observe that `keeperFundingTx` and `orchestratorInitTx` are nullable, but `routeInitTxs` and `sessionInitTxs` are not.

## Evidence

Local docs snapshot line references:

- `reports/private/docs/api-reference/transfers/prepare.md:11` says null fields are already on-chain.
- `reports/private/docs/api-reference/transfers/prepare.md:42-43` says `routeInitTxs` is an array and empty if route is already deployed.
- `reports/private/docs/api-reference/transfers/prepare.md:50-51` says `sessionInitTxs` is an array and entries for initialized steps are omitted.
- `reports/private/docs/api-reference/transfers/prepare.md:80-81` refers to all groups being null/empty.
- `reports/private/docs/guides/agentic-integration.md:323-330` says the server returns `null` for already confirmed groups and shows `routeInitTxs: null`.
- `reports/private/docs/openapi.json:204-223` defines `routeInitTxs` and `sessionInitTxs` as arrays without `nullable: true`.
- `reports/private/docs/openapi.json:214-227` marks `orchestratorInitTx` and `keeperFundingTx` nullable.

Docs checker output:

```text
MH-DOC-005: PreparedTxBundle nullability is inconsistent for resumed route/session arrays
Evidence:
- Agentic resume example shows routeInitTxs: null.
- Prepare API reference describes routeInitTxs/sessionInitTxs as arrays, empty when already done.
- OpenAPI PreparedTxBundle marks keeperFundingTx/orchestratorInitTx nullable but not routeInitTxs/sessionInitTxs.
```

## Expected Result

The API reference, Agentic guide, and OpenAPI schema should agree on one shape:

Option A:

```json
{
  "routeInitTxs": [],
  "sessionInitTxs": []
}
```

Option B:

```json
{
  "routeInitTxs": null,
  "sessionInitTxs": null
}
```

If both are possible, OpenAPI should explicitly model `array | null`.

## Actual Result

Different docs teach different shapes for resumed bundles:

- Agentic guide: `null` groups.
- Prepare API reference: arrays, empty or omitted.
- OpenAPI: arrays only for route/session, nullable only for keeper/orchestrator.

## Impact

This is directly relevant to safe agent resume behavior:

- OpenAPI-generated TypeScript clients may type `routeInitTxs` and `sessionInitTxs` as arrays only.
- Agents may call `.map` or `.length` on `null` in the resume path.
- A crash in resume handling can occur after keeper funding or partial route deployment, which is one of the highest-risk moments for this flow.

## Proposed Fix

If the API can return null arrays, update OpenAPI:

```json
"routeInitTxs": {
  "type": "array",
  "nullable": true,
  "items": { "type": "object", "properties": { "base64": { "type": "string" } } }
},
"sessionInitTxs": {
  "type": "array",
  "nullable": true,
  "items": { "type": "string" }
}
```

Also update the Prepare API reference to say:

```markdown
routeInitTxs and sessionInitTxs may be null when the whole group is already on-chain, or arrays containing only remaining transactions. Treat null and [] as no work for that group.
```

If the API always returns arrays, update the Agentic guide resume example to use `[]` instead of `null`.

## Contact

TBD
