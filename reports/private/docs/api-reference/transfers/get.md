> ## Documentation Index
> Fetch the complete documentation index at: https://dev-docs.multihopper.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Get Transfer

> Retrieve a transfer by its internal ID or external ID

Retrieve a transfer by its internal ID. Returns the extended transfer object including `phase`, `progress`, `recovery`, and `signatures`.

A companion endpoint at `GET /api/v1/transfers/by-external/{externalId}` returns the same response shape using your external ID.

## Path parameters

<ParamField path="transferId" type="integer" required>
  The internal transfer ID.
</ParamField>

## Response

<ResponseField name="id" type="integer">Transfer ID.</ResponseField>

<ResponseField name="status" type="string">
  Transfer status: `quote` | `awaiting_signature` | `processing` | `completed` | `failed` | `expired` | `refunded`
</ResponseField>

<ResponseField name="phase" type="string">
  Finer-grained execution phase derived from on-chain state: `quoted` | `deploying` | `executing` | `settled` | `failed` | `recoverable` | `rescued` | `reclaimed` | `expired`
</ResponseField>

<ResponseField name="progress" type="object">
  <Expandable title="progress fields">
    <ResponseField name="progress.hopsCompleted" type="integer">Number of hops that have executed.</ResponseField>
    <ResponseField name="progress.hopsTotal" type="integer">Total number of hops in the route.</ResponseField>
  </Expandable>
</ResponseField>

<ResponseField name="lastError" type="object | null">
  Last error recorded for this transfer, if any.

  <Expandable title="lastError fields">
    <ResponseField name="lastError.code" type="string">Structured error code (e.g. `MH_037`).</ResponseField>
    <ResponseField name="lastError.message" type="string">Human-readable error message.</ResponseField>
    <ResponseField name="lastError.at" type="string">ISO 8601 timestamp of when the error occurred.</ResponseField>
  </Expandable>
</ResponseField>

<ResponseField name="recovery" type="object | null">
  Recovery options. Only populated when `phase` is `recoverable`, `settled`, `rescued`, or `reclaimed`.

  <Expandable title="recovery fields">
    <ResponseField name="recovery.canRescue" type="boolean">Whether locked funds can be rescued via `/rescue/prepare`.</ResponseField>
    <ResponseField name="recovery.rescuableLamports" type="integer">Total lamports recoverable.</ResponseField>
    <ResponseField name="recovery.rescuableAccounts" type="array">Accounts with locked funds: `[{ kind, lamports }]`</ResponseField>
    <ResponseField name="recovery.canReclaimRent" type="boolean">Whether closed step account rent can be reclaimed.</ResponseField>
    <ResponseField name="recovery.reclaimableLamports" type="integer">Total reclaimable rent in lamports.</ResponseField>
  </Expandable>
</ResponseField>

<ResponseField name="signatures" type="object">
  On-chain transaction signatures recorded for this transfer.

  <Expandable title="signatures fields">
    <ResponseField name="signatures.routeInit" type="array">Route initialization transaction hashes.</ResponseField>
    <ResponseField name="signatures.sessionInit" type="array">Session initialization transaction hashes.</ResponseField>
    <ResponseField name="signatures.hops" type="array">Hop execution transaction hashes.</ResponseField>
  </Expandable>
</ResponseField>

<RequestExample>
  ```bash cURL — by internal ID theme={null}
  curl /api/v1/transfers/42 \
    -H "x-api-key: mh_live_abc123..."
  ```

  ```bash cURL — by external ID theme={null}
  curl /api/v1/transfers/by-external/order_12345 \
    -H "x-api-key: mh_live_abc123..."
  ```
</RequestExample>

<ResponseExample>
  ```json 200 theme={null}
  {
    "id": 42,
    "externalId": "order_12345",
    "status": "processing",
    "phase": "executing",
    "progress": { "hopsCompleted": 3, "hopsTotal": 7 },
    "lastError": null,
    "recovery": null,
    "signatures": {
      "routeInit": ["4mGxFn7m..."],
      "sessionInit": [],
      "hops": ["9rTpWx2a...", "7kLmQv4b..."]
    }
  }
  ```

  ```json 404 theme={null}
  {
    "error": {
      "code": "MH_030",
      "message": "Transfer not found"
    }
  }
  ```
</ResponseExample>
