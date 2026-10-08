# MH-API-007: Webhook registration accepts plaintext HTTP callback URLs despite HTTPS contract

Severity: Medium

## Summary

The Webhook registration docs and OpenAPI schema describe the callback URL as an HTTPS URL. Live devnet accepted `http://example.com/webhook`, activated the webhook, and returned a signing secret. The response also returned the secret as raw hex rather than the documented `whsec_...` format.

Webhook payloads can include transfer lifecycle data. If agents can register plaintext HTTP callback URLs, event payloads and signatures may be exposed or altered in transit between MultiHopper and the receiver. This contradicts the documented security expectation and can lead automated agents to deploy an insecure webhook monitor.

The test webhook was immediately deleted, and `GET /webhooks` returned an empty list afterward. A separate control with a valid HTTPS URL showed that idempotency replay returns the same raw signing secret again for the same `Idempotency-Key`, so the one-time-secret wording also needs clarification.

## What I Built Or Used

- Direct devnet API checks with the approved test key passed through shell headers only.
- No private key was loaded.
- No transfer was signed or broadcast.
- A single test webhook endpoint was created and then deleted during cleanup.

## Affected Flow

- `POST /webhooks`
- Webhook-based transfer monitoring for agentic workflows
- Secret handling and webhook receiver setup

## Steps To Reproduce

1. Call `POST /webhooks` on devnet with an idempotency key.
2. Use a plaintext callback URL:

```json
{
  "url": "http://example.com/webhook",
  "events": ["transfer.completed"]
}
```

3. Observe the API returns HTTP 200, creates an active webhook, and returns a signing secret.
4. Delete the webhook with `DELETE /webhooks/{endpointId}` and a valid `Idempotency-Key`.
5. Confirm `GET /webhooks` returns no active test webhook.

## Evidence

Docs and OpenAPI require HTTPS:

```text
reports/private/docs/api-reference/webhooks/create.md
The HTTPS URL to receive webhook events.

reports/private/docs/openapi.json createWebhook requestBody.url.description
The HTTPS URL to receive webhook events.
```

Live devnet accepted HTTP:

```text
POST /webhooks
Idempotency-Key: probe.webhook.invalid.http-url.1783281001
body.url: http://example.com/webhook
body.events: ["transfer.completed"]

HTTP 200
{
  "id": 287,
  "url": "http://example.com/webhook",
  "secret": "[redacted 64-character hex signing secret]",
  "events": ["transfer.completed"],
  "isActive": true,
  "createdAt": "2026-07-05T23:57:36.280Z"
}
```

The human docs show a prefixed secret:

```text
reports/private/docs/api-reference/webhooks/create.md
HMAC-SHA256 signing secret prefixed with whsec_.
```

Live response returned a raw 64-character hex string instead of a `whsec_...` value.

Idempotency replay control:

```text
POST /webhooks with Idempotency-Key: probe.webhook.secret-list.1783296396320
body.url: https://example.com/multihopper-secret-list-1783296396320

HTTP 200
secret: [redacted 64-character signing secret]

Replay same request with same Idempotency-Key
HTTP 200
secret: [same redacted 64-character signing secret returned again]
```

Cleanup:

```text
DELETE /webhooks/287
Idempotency-Key: probe.webhook.cleanup.287.1783281111

HTTP 200
{ "deleted": true }

GET /webhooks
HTTP 200
{ "items": [] }
```

## Expected Result

`POST /webhooks` should reject non-HTTPS callback URLs:

```text
HTTP 400
error.code: documented validation code
error.message: url must use https
```

The response secret format should also match the docs, or the docs should be updated to describe the actual raw-hex format.

## Actual Result

- `http://example.com/webhook` was accepted.
- The webhook was active.
- The signing secret did not use the documented `whsec_` prefix.
- The same signing secret was returned again on idempotency replay, so "shown once" is ambiguous for retried create requests.

## Impact

Agent impact:

- An agent can register an insecure webhook endpoint even though the docs imply the API enforces HTTPS.
- Webhook monitoring can leak transfer lifecycle payloads over plaintext HTTP.
- Agents validating the documented `whsec_` prefix may reject valid live secrets, while agents that do not validate the transport may silently accept insecure callback URLs.

Operational impact:

- Integrators may discover webhook transport issues only after events are sent.
- Security posture depends on client-side discipline instead of server-side enforcement.

## Proposed Fix

- Enforce `https:` URLs server-side for webhook creation.
- Return a documented error code for non-HTTPS URLs.
- Align the signing secret response format with docs:
  - either return `whsec_...`, or
  - update docs and examples to say the secret is raw hex.
- Clarify whether idempotency replay may return the same one-time secret again.
- Add regression tests for accepted `https://` URLs and rejected `http://` URLs.

## Contact

TBD
