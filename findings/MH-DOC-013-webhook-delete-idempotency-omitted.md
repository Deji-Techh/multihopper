# MH-DOC-013: Webhook delete requires `Idempotency-Key` but docs and OpenAPI omit it

Severity: Documentation blocker

## Summary

Live devnet requires an `Idempotency-Key` header for `DELETE /webhooks/{endpointId}`. Without the header, the endpoint returns `400 MH_070`. With a valid idempotency key, the same delete succeeds.

The Delete Webhook page and OpenAPI `deleteWebhook` operation only document the `endpointId` path parameter. Agents generated from the docs or OpenAPI will fail to deactivate webhooks, including cleanup after test runs.

## What I Built Or Used

- Direct devnet API checks with the approved test key passed through shell headers only.
- A test webhook created during `MH-API-007` reproduction.
- No private key was loaded.
- No transfer was signed or broadcast.

## Affected Flow

- `DELETE /webhooks/{endpointId}`
- Webhook cleanup and monitoring lifecycle for agentic integrations
- OpenAPI-generated SDKs and MCP tools

## Steps To Reproduce

1. Register a webhook in the approved test environment.
2. Call `DELETE /webhooks/{endpointId}` without `Idempotency-Key`.
3. Observe `400 MH_070`.
4. Repeat the same delete with a valid `Idempotency-Key`.
5. Observe HTTP 200 and `{ "deleted": true }`.

## Evidence

Docs omit the header:

```text
reports/private/docs/api-reference/webhooks/delete.md
Path parameters:
- endpointId

Request example:
curl -X DELETE /api/v1/webhooks/1 \
  -H "x-api-key: mh_live_abc123..."
```

OpenAPI omits the header:

```text
operationId: deleteWebhook
parameters:
- endpointId in path
```

Live devnet without idempotency:

```text
DELETE /webhooks/287

HTTP 400
{
  "error": {
    "code": "MH_070",
    "message": "Idempotency-Key header required for this mutation (8-64 chars, [a-zA-Z0-9._-])"
  }
}
```

Live devnet with idempotency:

```text
DELETE /webhooks/287
Idempotency-Key: probe.webhook.cleanup.287.1783281111

HTTP 200
{ "deleted": true }
```

Cleanup verification:

```text
GET /webhooks
HTTP 200
{ "items": [] }
```

## Expected Result

The Delete Webhook docs and OpenAPI should mark `Idempotency-Key` as required if the live API requires it:

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

- Live API requires `Idempotency-Key` for webhook deletion.
- Human docs do not mention it.
- OpenAPI does not model it.

## Impact

Agent impact:

- Agents cannot reliably clean up webhook endpoints using generated clients.
- A failed cleanup may leave stale webhook endpoints active.
- Recovery from a bad webhook URL requires undocumented behavior.

Operational impact:

- Test automation and CI cleanup scripts can accumulate inactive or unwanted webhook endpoints.
- The idempotency contract is inconsistent across docs: the introduction mentions POST mutations, but this DELETE mutation also enforces the header.

## Proposed Fix

- Document that `DELETE /webhooks/{endpointId}` requires `Idempotency-Key`.
- Add the header to the OpenAPI `deleteWebhook` operation.
- Update the Delete Webhook cURL example.
- Clarify whether all mutations, not only POST mutations, require idempotency keys.

## Contact

TBD
