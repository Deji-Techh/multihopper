# MH-DOC-009: OpenAPI omits required `Idempotency-Key` header on mutating POST operations

Severity: Documentation blocker

## Summary

The API Introduction says all `POST` mutations require an `Idempotency-Key` header, and the live devnet API enforces this with `400 MH_070`. However, the OpenAPI specification contains zero `Idempotency-Key` header parameter definitions. Agents or SDKs generated from OpenAPI will not know to send the required header and will fail on the first mutating step.

## What I Built Or Used

- Official docs snapshot fetched from `https://dev-docs.multihopper.com`.
- OpenAPI file: `reports/private/docs/openapi.json`.
- Direct devnet API checks with the approved test key passed through environment/shell only.
- No transaction was signed or broadcast.

## Affected Flow

Generated clients and agent tools for mutating POST operations:

- `POST /transfers`
- `POST /transfers/{transferId}/prepare`
- `POST /transfers/{transferId}/confirm-broadcast`
- `POST /transfers/{transferId}/rescue/prepare`
- `POST /transfers/{transferId}/rescue/confirm`
- `POST /transfers/{transferId}/reclaim-rent/prepare`
- `POST /transfers/{transferId}/reclaim-rent/confirm`
- `POST /webhooks`

## Steps To Reproduce

1. Fetch the OpenAPI spec from the docs.
2. Search the spec for `Idempotency-Key`.
3. Inspect POST operation parameters.
4. Call a mutating endpoint without `Idempotency-Key`.

## Evidence

Docs requirement:

```text
reports/private/docs/api-reference/introduction.md:50-52
All POST mutations require an Idempotency-Key header.
```

OpenAPI inspection:

```bash
jq -r '[paths(scalars) as $p | select(getpath($p)|tostring|test("Idempotency-Key"))] | length' reports/private/docs/openapi.json
```

Result:

```text
0
```

POST operation parameter summary from OpenAPI:

```text
/transfers                                      post  parameters: none
/transfers/{transferId}/prepare                post  parameters: transferId
/transfers/{transferId}/confirm-broadcast      post  parameters: transferId
/transfers/{transferId}/rescue/prepare         post  parameters: transferId
/transfers/{transferId}/rescue/confirm         post  parameters: transferId
/transfers/{transferId}/reclaim-rent/prepare   post  parameters: transferId
/transfers/{transferId}/reclaim-rent/confirm   post  parameters: transferId
/webhooks                                      post  parameters: none
```

Live API control:

```text
POST /transfers/908/prepare without Idempotency-Key
HTTP 400
error.code: MH_070
message: Idempotency-Key header required for this mutation (8-64 chars, [a-zA-Z0-9._-])
```

Webhook create control:

```text
POST /webhooks without Idempotency-Key
body.url: https://example.com/multihopper-webhook
body.events: ["transfer.completed"]

HTTP 400
error.code: MH_070
message: Idempotency-Key header required for this mutation (8-64 chars, [a-zA-Z0-9._-])
```

Control with a UUID idempotency key:

```text
POST /transfers/908/prepare with Idempotency-Key: cbae5a6e-4943-4328-82ad-845f918b47a3
HTTP 200
```

## Expected Result

OpenAPI should model every required runtime header, especially headers needed by generated clients:

```json
{
  "name": "Idempotency-Key",
  "in": "header",
  "required": true,
  "schema": {
    "type": "string",
    "minLength": 8,
    "maxLength": 64,
    "pattern": "^[a-zA-Z0-9._-]+$"
  }
}
```

## Actual Result

OpenAPI has no `Idempotency-Key` references, and mutating POST operations only define body/path parameters.

## Impact

Agent impact:

- OpenAPI-generated SDKs and MCP tools will omit a required header.
- Agents will receive `MH_070` at create, prepare, confirm, webhook registration, or recovery steps.
- This blocks automated workflows even when the human API introduction is correct.

Reliability impact:

- The idempotency contract is one of the bounty's core testing areas.
- Generated clients cannot reliably implement duplicate submission, retry, or recovery behavior from the machine-readable spec alone.

## Proposed Fix

- Add a reusable `IdempotencyKey` header parameter under `components.parameters`.
- Reference it from all mutating POST operations.
- Include examples using a UUID.
- Ensure generated SDK/MCP tooling marks it required for create, prepare, confirm-broadcast, rescue, reclaim-rent, and webhook registration.
- Optionally document that read-only `POST /transfers/estimate` is exempt if it does not mutate state.

## Contact

TBD
