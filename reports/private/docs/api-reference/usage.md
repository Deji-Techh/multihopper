> ## Documentation Index
> Fetch the complete documentation index at: https://dev-docs.multihopper.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Usage

> Get usage and fee summary for your integration

## Query parameters

<ParamField query="fromDate" type="string">
  ISO 8601 start date (e.g. `2025-01-01T00:00:00.000Z`).
</ParamField>

<ParamField query="toDate" type="string">
  ISO 8601 end date.
</ParamField>

## Response

<ResponseField name="totalTransfers" type="integer">Total number of transfers in the period.</ResponseField>
<ResponseField name="completedTransfers" type="integer">Number of successfully completed transfers.</ResponseField>
<ResponseField name="failedTransfers" type="integer">Number of failed transfers.</ResponseField>
<ResponseField name="totalVolumeRaw" type="string">Total transfer volume in base token units (returned as a string to preserve bigint precision).</ResponseField>
<ResponseField name="totalFlatFeeEarned" type="integer">Total flat fee earned by your integration in lamports.</ResponseField>
<ResponseField name="totalPayouts" type="integer">Number of integrator reward payouts settled on-chain in the period.</ResponseField>
<ResponseField name="isTestMode" type="boolean">Whether this summary reflects test-mode transfers.</ResponseField>

<RequestExample>
  ```bash cURL theme={null}
  curl "/api/v1/usage?fromDate=2025-01-01T00:00:00.000Z&toDate=2025-01-31T23:59:59.000Z" \
    -H "x-api-key: mh_live_abc123..."
  ```
</RequestExample>

<ResponseExample>
  ```json 200 theme={null}
  {
    "totalTransfers": 142,
    "completedTransfers": 130,
    "failedTransfers": 5,
    "totalVolumeRaw": "142000000000",
    "totalFlatFeeEarned": 5460000,
    "totalPayouts": 0,
    "isTestMode": false
  }
  ```
</ResponseExample>
