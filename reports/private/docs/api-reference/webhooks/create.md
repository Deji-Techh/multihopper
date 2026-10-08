> ## Documentation Index
> Fetch the complete documentation index at: https://dev-docs.multihopper.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Register Webhook

> Register an endpoint to receive transfer lifecycle events

Registers a webhook endpoint. Returns a signing secret — store it securely, it is only shown once.

## Request body

<ParamField body="url" type="string" required>
  The HTTPS URL to receive webhook events.
</ParamField>

<ParamField body="events" type="array">
  List of event types to subscribe to. Defaults to all events if omitted.

  Available events:

  * `transfer.quote_created`
  * `transfer.deposit_confirmed`
  * `transfer.processing`
  * `transfer.hop_complete`
  * `transfer.completed`
  * `transfer.failed`
  * `transfer.expired`
  * `transfer.refunded`
  * `payout.completed`
</ParamField>

## Response

<ResponseField name="id" type="integer">Webhook endpoint ID.</ResponseField>
<ResponseField name="url" type="string">The registered URL.</ResponseField>

<ResponseField name="secret" type="string">
  HMAC-SHA256 signing secret prefixed with `whsec_`. **Shown once — store this securely.**
</ResponseField>

<ResponseField name="events" type="array">Subscribed event types.</ResponseField>

<RequestExample>
  ```bash cURL theme={null}
  curl -X POST /api/v1/webhooks \
    -H "x-api-key: mh_live_abc123..." \
    -H "Content-Type: application/json" \
    -d '{
      "url": "https://your-app.com/webhooks/multihopper",
      "events": ["transfer.completed", "transfer.failed"]
    }'
  ```
</RequestExample>

<ResponseExample>
  ```json 200 theme={null}
  {
    "id": 1,
    "url": "https://your-app.com/webhooks/multihopper",
    "secret": "whsec_abc123...",
    "events": ["transfer.completed", "transfer.failed"]
  }
  ```
</ResponseExample>
