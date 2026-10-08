> ## Documentation Index
> Fetch the complete documentation index at: https://dev-docs.multihopper.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Delete Webhook

> Delete a registered webhook endpoint

## Path parameters

<ParamField path="endpointId" type="integer" required>
  The webhook endpoint ID to delete.
</ParamField>

## Response

<ResponseField name="deleted" type="boolean">
  `true` if the endpoint was successfully deleted.
</ResponseField>

<RequestExample>
  ```bash cURL theme={null}
  curl -X DELETE /api/v1/webhooks/1 \
    -H "x-api-key: mh_live_abc123..."
  ```
</RequestExample>

<ResponseExample>
  ```json 200 theme={null}
  {
    "deleted": true
  }
  ```
</ResponseExample>
