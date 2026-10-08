> ## Documentation Index
> Fetch the complete documentation index at: https://dev-docs.multihopper.com/llms.txt
> Use this file to discover all available pages before exploring further.

# List Transfers

> List transfers with pagination and optional filters

## Query parameters

<ParamField query="status" type="string">
  Filter by transfer status (e.g. `completed`, `processing`, `failed`).
</ParamField>

<ParamField query="fromDate" type="string">
  ISO 8601 start date filter (e.g. `2025-01-01T00:00:00.000Z`).
</ParamField>

<ParamField query="toDate" type="string">
  ISO 8601 end date filter.
</ParamField>

<ParamField query="externalId" type="string">
  Filter by your external ID.
</ParamField>

<ParamField query="supportBundleId" type="string">
  Filter by support bundle ID.
</ParamField>

<ParamField query="limit" type="integer" default="50">
  Number of results to return.
</ParamField>

<ParamField query="offset" type="integer" default="0">
  Pagination offset.
</ParamField>

## Response

<ResponseField name="items" type="array">
  Array of transfer objects.
</ResponseField>

<ResponseField name="pagination" type="object">
  <Expandable title="pagination fields">
    <ResponseField name="pagination.total" type="integer">Total number of matching transfers.</ResponseField>
    <ResponseField name="pagination.limit" type="integer">Page size used.</ResponseField>
    <ResponseField name="pagination.offset" type="integer">Current offset.</ResponseField>
  </Expandable>
</ResponseField>

<RequestExample>
  ```bash cURL theme={null}
  curl "/api/v1/transfers?status=completed&fromDate=2025-01-01T00:00:00.000Z&limit=50" \
    -H "x-api-key: mh_live_abc123..."
  ```
</RequestExample>

<ResponseExample>
  ```json 200 theme={null}
  {
    "items": [
      {
        "id": 42,
        "externalId": "order_12345",
        "status": "completed",
        "phase": "settled",
        "progress": { "hopsCompleted": 7, "hopsTotal": 7 }
      }
    ],
    "pagination": {
      "total": 142,
      "limit": 50,
      "offset": 0
    }
  }
  ```
</ResponseExample>
