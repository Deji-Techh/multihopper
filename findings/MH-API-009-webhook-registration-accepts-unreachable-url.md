# MH-API-009: Webhook registration accepts unreachable callback URLs despite documented `MH_050`

Severity: Medium

## Summary

The API Introduction documents `MH_050 Webhook URL unreachable`, implying webhook registration validates callback reachability. Live devnet accepted an HTTPS URL on a reserved `.invalid` domain, marked the webhook active, and returned a signing secret.

For agentic workflows, this means an agent can believe webhook monitoring is configured successfully even though no lifecycle events can be delivered. Monitoring then silently fails, and the agent may miss transfer failures, rescue opportunities, expiry, or completion events.

The test webhook was immediately deleted, and `GET /webhooks` returned an empty list afterward.

## What I Built Or Used

- Direct devnet API checks with the approved test key passed through shell headers only.
- Reserved `.invalid` domain to avoid contacting a real third-party service.
- No private key was loaded.
- No transfer was signed or broadcast.
- A single test webhook endpoint was created and then deleted during cleanup.

## Affected Flow

- `POST /webhooks`
- Webhook-based monitoring for `create -> prepare -> sign/broadcast -> confirm-broadcast -> monitor`
- Agent recovery decisions based on webhook events

## Steps To Reproduce

1. Call `POST /webhooks` on devnet with a valid idempotency key.
2. Use a reserved, non-resolvable callback URL:

```json
{
  "url": "https://nonexistent-mh-1783296474276.invalid/webhook",
  "events": ["transfer.completed"]
}
```

3. Observe HTTP 200 with an active webhook and a signing secret.
4. Delete the webhook with `DELETE /webhooks/{endpointId}` and a fresh `Idempotency-Key`.
5. Confirm `GET /webhooks` returns an empty list.

## Evidence

Docs define an unreachable-url error:

```text
reports/private/docs/api-reference/introduction.md
MH_050 Webhook URL unreachable
```

Live devnet accepted a reserved `.invalid` URL:

```text
POST /webhooks
Idempotency-Key: probe.webhook.unreachable.1783296474276
body.url: https://nonexistent-mh-1783296474276.invalid/webhook
body.events: ["transfer.completed"]

HTTP 200
{
  "id": 292,
  "url": "https://nonexistent-mh-1783296474276.invalid/webhook",
  "secret": "[redacted 64-character signing secret]",
  "events": ["transfer.completed"],
  "isActive": true,
  "createdAt": "2026-07-06T00:08:08.579Z"
}
```

Cleanup:

```text
DELETE /webhooks/292
HTTP 200
{ "deleted": true }

GET /webhooks
HTTP 200
{ "items": [] }
```

## Expected Result

The API should reject unreachable webhook callback URLs:

```text
HTTP 400
error.code: MH_050
error.message: Webhook URL unreachable
```

If reachability checks are intentionally asynchronous or not performed, the docs should remove `MH_050` from registration expectations and expose a delivery-health state instead.

## Actual Result

- A reserved `.invalid` callback URL was accepted.
- The webhook was marked `isActive: true`.
- No `MH_050` error was returned.

## Impact

Agent impact:

- Agents may rely on webhook monitoring that can never receive events.
- Expiry, failure, rescue, and completion handling can be missed.
- Recovery workflows may stall because the monitor path appears configured.

Operational impact:

- Integrators may accumulate dead webhook endpoints.
- Failed delivery may only be discovered after a transfer is already in flight.

## Proposed Fix

- Validate webhook URL reachability during registration and return `MH_050` when unreachable.
- Alternatively, accept the endpoint as pending and expose a clear health/status field before marking it active.
- Add regression tests for:
  - reachable HTTPS endpoint accepted,
  - non-resolvable domain rejected or marked pending,
  - non-HTTPS endpoint rejected,
  - failed delivery health visible in `GET /webhooks`.

## Contact

TBD
