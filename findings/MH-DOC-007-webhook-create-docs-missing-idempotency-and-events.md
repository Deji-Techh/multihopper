# MH-DOC-007: Webhook create docs omit required idempotency header and list stale event types

Severity: Documentation blocker

## Summary

The Register Webhook API page documents `POST /webhooks`, which is a mutating endpoint. The request example omits `Idempotency-Key`, even though the endpoint enforces it and returns `400 MH_070` when the header is missing. The same page also lists fewer event types than the Webhook Events page and OpenAPI enum, omitting `transfer.phase_changed`, `transfer.recoverable`, `transfer.rescued`, and `transfer.rent_reclaimed`.

This can cause agents to fail webhook registration with `MH_070` and to miss recovery-related monitoring events.

## What I Built Or Used

- Existing TypeScript audit workspace in `/home/DejiTech/multihopper`.
- Official docs snapshot fetched from `https://dev-docs.multihopper.com`.
- Direct safe devnet API checks.
- No private key was loaded.
- No Solana transaction was signed or broadcast.

## Affected Flow

- `POST /webhooks`
- Webhook-based monitoring.
- Agent subscription to recovery lifecycle events.

## Steps To Reproduce

1. Open `https://dev-docs.multihopper.com/api-reference/webhooks/create`.
2. Observe the `POST /webhooks` cURL example.
3. Observe that it does not include `Idempotency-Key`.
4. Send a valid webhook create request without `Idempotency-Key`.
5. Observe `400 MH_070`.
6. Compare the event list on the Register Webhook page with the Webhook Events page and OpenAPI enum.

## Evidence

Docs line references:

- `reports/private/docs/api-reference/webhooks/create.md:45-52` shows `POST /webhooks` without `Idempotency-Key`.
- `reports/private/docs/api-reference/webhooks/create.md:22-30` lists available events but omits recovery/phase events.
- `reports/private/docs/api-reference/webhooks/events.md:39` includes `transfer.phase_changed`.
- `reports/private/docs/api-reference/webhooks/events.md:45-47` includes `transfer.recoverable`, `transfer.rescued`, and `transfer.rent_reclaimed`.
- `reports/private/docs/openapi.json:1220-1223` includes those same omitted events in the webhook create enum.

Safe API check:

```text
POST /webhooks
url: https://example.com/multihopper-audit-<timestamp>
Idempotency-Key: omitted
status: 400
error.code: MH_070
message: Idempotency-Key header required for this mutation
```

## Expected Result

The Register Webhook cURL example should include:

```bash
-H "Idempotency-Key: $(uuidgen)" \
```

The event list should match the Webhook Events page and OpenAPI enum.

## Actual Result

The cURL example omits the required idempotency header, and the event list omits:

- `transfer.phase_changed`
- `transfer.recoverable`
- `transfer.rescued`
- `transfer.rent_reclaimed`

## Impact

Agent impact:

- A copy-paste agent fails to register webhooks with `MH_070`.
- Agents may not subscribe to recovery events because the create page does not list them.
- Recovery monitoring becomes weaker, especially for `recoverable`, `rescued`, and `rent_reclaimed` flows.

## Proposed Fix

Update the Register Webhook example:

```bash
curl -X POST /api/v1/webhooks \
  -H "x-api-key: mh_test_abc123..." \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
    "url": "https://your-app.com/webhooks/multihopper",
    "events": ["transfer.completed", "transfer.failed"]
  }'
```

Update the available events list to include all events in the OpenAPI enum and Webhook Events page.

## Contact

TBD
