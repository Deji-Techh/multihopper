# MH-API-010: Duplicate webhook registrations for the same URL and events create multiple active endpoints

Severity: Medium

## Summary

Live devnet allowed two active webhook endpoints with the exact same callback URL and event set when requests used different idempotency keys. Each duplicate received a distinct endpoint ID and signing secret.

For agentic integrations, duplicate endpoints can cause duplicate lifecycle event delivery, duplicate recovery actions, confusing idempotency behavior in the receiver, and unnecessary consumption of the documented webhook endpoint quota.

Both duplicate test endpoints were immediately deleted, and `GET /webhooks` returned an empty list afterward.

## What I Built Or Used

- Direct devnet API checks with the approved test key passed through shell headers only.
- Two `POST /webhooks` calls with the same URL and events but different idempotency keys.
- No private key was loaded.
- No transfer was signed or broadcast.
- Both created webhook endpoints were deleted during cleanup.

## Affected Flow

- `POST /webhooks`
- Webhook event delivery
- Agent monitoring and recovery workflows

## Steps To Reproduce

1. Call `POST /webhooks` with a valid HTTPS URL and events.
2. Repeat the same request body with a new `Idempotency-Key`.
3. Call `GET /webhooks`.
4. Observe two active endpoints with the same URL and events.
5. Delete both endpoints.
6. Confirm `GET /webhooks` returns an empty list.

## Evidence

First create:

```text
POST /webhooks
body.url: https://example.com/multihopper-duplicate-1783296420758
body.events: ["transfer.completed"]

HTTP 200
{
  "id": 290,
  "url": "https://example.com/multihopper-duplicate-1783296420758",
  "secret": "[redacted 64-character signing secret]",
  "events": ["transfer.completed"],
  "isActive": true,
  "createdAt": "2026-07-06T00:07:14.878Z"
}
```

Second create with same body and a new idempotency key:

```text
POST /webhooks
body.url: https://example.com/multihopper-duplicate-1783296420758
body.events: ["transfer.completed"]

HTTP 200
{
  "id": 291,
  "url": "https://example.com/multihopper-duplicate-1783296420758",
  "secret": "[redacted 64-character signing secret]",
  "events": ["transfer.completed"],
  "isActive": true,
  "createdAt": "2026-07-06T00:07:16.079Z"
}
```

List response while both were active:

```text
GET /webhooks
HTTP 200
matchingUrlCount: 2
items:
- id: 290, url: same URL, events: ["transfer.completed"], isActive: true
- id: 291, url: same URL, events: ["transfer.completed"], isActive: true
```

Cleanup:

```text
DELETE /webhooks/290
HTTP 200
{ "deleted": true }

DELETE /webhooks/291
HTTP 200
{ "deleted": true }

GET /webhooks
HTTP 200
{ "items": [] }
```

## Expected Result

The API should either:

- return the existing endpoint for the same URL and event set,
- return a documented conflict such as `409`,
- or require an explicit label/scope that makes duplicate registrations intentional.

## Actual Result

Two active webhook endpoints were created for the same URL and event set.

## Impact

Agent impact:

- Duplicate event delivery can trigger duplicate polling, duplicate recovery attempts, or duplicate user notifications.
- Receiver-side idempotency becomes harder because the same event may arrive with different webhook secrets.
- Agents may accidentally exhaust webhook endpoint quota while retrying setup with new idempotency keys.

Operational impact:

- Integrators can accumulate redundant active endpoints.
- Debugging event delivery becomes harder because multiple endpoint IDs point to the same receiver.

## Proposed Fix

- Enforce uniqueness on active webhook endpoints by integration, URL, and normalized event set.
- Return a documented duplicate error or existing endpoint metadata when a duplicate is submitted.
- If duplicate endpoints are intended, document the behavior and include a clear use case.

## Contact

TBD
