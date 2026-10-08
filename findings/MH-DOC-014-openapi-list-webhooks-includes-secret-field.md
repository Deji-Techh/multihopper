# MH-DOC-014: OpenAPI `listWebhooks` includes a `secret` field that human docs and live API omit

Severity: Documentation blocker

## Summary

The human Webhook registration docs say the signing secret is shown once. The List Webhooks page omits `secret` from response fields and examples, and live `GET /webhooks` while an endpoint was active did not include any `secret` field. However, OpenAPI models `items[].secret` in the `listWebhooks` response schema.

Generated SDKs and MCP tools may expose `secret` as a normal list response field, encouraging agents to wait for, log, or mishandle a secret that is not returned by the live API and should not be treated as listable state.

## What I Built Or Used

- Official docs snapshot fetched from `https://dev-docs.multihopper.com`.
- Direct devnet webhook create/list/delete check with the approved test key.
- No private key was loaded.
- No transfer was signed or broadcast.

## Affected Flow

- `GET /webhooks`
- OpenAPI-generated SDKs and MCP tools
- Webhook secret handling in agentic integrations

## Steps To Reproduce

1. Inspect the List Webhooks human docs.
2. Inspect OpenAPI `paths["/webhooks"].get.responses["200"]...items.properties`.
3. Register a test webhook.
4. Call `GET /webhooks` while the webhook is active.
5. Observe live list items omit `secret`.
6. Delete the test webhook.

## Evidence

Human docs omit `secret`:

```text
reports/private/docs/api-reference/webhooks/list.md
Webhook fields:
- id
- url
- events
- isActive
- createdAt
```

OpenAPI includes `secret`:

```text
paths./webhooks.get.responses.200.content.application/json.schema.properties.items.items.properties.secret
type: string
nullable: true
```

Live `GET /webhooks` while a webhook was active:

```text
HTTP 200
{
  "items": [
    {
      "id": 289,
      "url": "https://example.com/multihopper-secret-list-1783296396320",
      "events": ["transfer.completed"],
      "isActive": true,
      "createdAt": "2026-07-06T00:06:50.986Z"
    }
  ]
}
```

Create response did include a secret, but as a raw 64-character string rather than the documented `whsec_...` format:

```text
POST /webhooks
HTTP 200
secret: [redacted 64-character signing secret]
```

Cleanup:

```text
DELETE /webhooks/289
HTTP 200
{ "deleted": true }

GET /webhooks
HTTP 200
{ "items": [] }
```

## Expected Result

OpenAPI should match live behavior and the one-time-secret contract:

- `createWebhook` response may include `secret`.
- `listWebhooks` response should not include `secret`, or it should explicitly document `secret: null` after creation.

## Actual Result

- OpenAPI models `items[].secret` on list responses.
- Human docs and live API omit it.

## Impact

Agent impact:

- Generated clients may expose a misleading secret field.
- Agents may incorrectly expect webhook secrets to be recoverable from `GET /webhooks`.
- Logging code generated from OpenAPI may treat `secret` as a normal list field, which is unsafe if the server later populates it.

Operational impact:

- Integrators may design incorrect secret recovery flows.
- Documentation conflicts around webhook secrets make secure receiver setup harder.

## Proposed Fix

- Remove `secret` from the `listWebhooks` response schema.
- Keep `secret` only on `createWebhook`.
- Align the create response secret format with the human docs, or update the docs to describe raw hex.
- Add a note: webhook signing secrets cannot be recovered by listing endpoints.

## Contact

TBD
