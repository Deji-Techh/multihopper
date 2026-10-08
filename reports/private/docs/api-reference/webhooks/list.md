> ## Documentation Index
> Fetch the complete documentation index at: https://dev-docs.multihopper.com/llms.txt
> Use this file to discover all available pages before exploring further.

# List Webhooks

> List all registered webhook endpoints

## Response

<ResponseField name="items" type="array">
  Array of webhook endpoint objects.

  <Expandable title="Webhook fields">
    <ResponseField name="id" type="integer">Webhook endpoint ID.</ResponseField>
    <ResponseField name="url" type="string">The registered URL.</ResponseField>
    <ResponseField name="events" type="array">Subscribed event types.</ResponseField>
    <ResponseField name="isActive" type="boolean">Whether the endpoint is active.</ResponseField>
    <ResponseField name="createdAt" type="string">ISO 8601 creation timestamp.</ResponseField>
  </Expandable>
</ResponseField>

<RequestExample>
  ```bash cURL theme={null}
  curl /api/v1/webhooks \
    -H "x-api-key: mh_live_abc123..."
  ```
</RequestExample>

<ResponseExample>
  ```json 200 theme={null}
  {
    "items": [
      {
        "id": 1,
        "url": "https://your-app.com/webhooks/multihopper",
        "events": ["transfer.completed", "transfer.failed"],
        "isActive": true,
        "createdAt": "2025-01-10T00:00:00.000Z"
      }
    ]
  }
  ```
</ResponseExample>
