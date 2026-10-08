> ## Documentation Index
> Fetch the complete documentation index at: https://dev-docs.multihopper.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Confirm Broadcast

> Report Solana transaction signatures after broadcasting prepared transactions

After signing and broadcasting the prepared transactions to Solana, call this endpoint to record the signatures. Once the full bundle is recorded the transfer advances to `processing` and the keeper network takes over.

This endpoint is **resumable** and **called twice** in the normal flow:

1. **Immediately after `keeperFundingTx`** — call with just `keeperFundingSignature` and an empty `routeInitSignatures: []`. This prevents the keeper from being double-funded if deployment is later resumed.
2. **After all remaining transactions** — call with `routeInitSignatures`, `orchestratorInitSignature`, and `sessionInitSignatures`.

<Warning>
  **Only make the final call once every transaction has actually confirmed on-chain.** This
  endpoint advances the transfer only if it can verify that the route, the orchestrator config,
  and **all** step PDAs already exist on-chain. If you report signatures for transactions that
  haven't landed yet (e.g. you broadcast lazily or out of order, or a tx silently dropped), the
  transfer stays at its pre-broadcast state, the keeper never picks it up, and the route stalls
  with no error. Broadcast in order — `keeperFundingTx` → `routeInitTxs` → `orchestratorInitTx`
  → `sessionInitTxs` — wait for confirmations, then call this endpoint. If a transfer appears
  stuck, re-call [`/prepare`](/api-reference/transfers/prepare) to see which groups are still
  missing (non-`null` fields), rebroadcast them, then confirm again.
</Warning>

## Path parameters

<ParamField path="transferId" type="integer" required>
  The internal transfer ID.
</ParamField>

## Request body

<ParamField body="routeInitSignatures" type="array" required>
  Base58 signatures for each `routeInitTxs` entry. Pass an empty array `[]` on the intermediate call (after keeper funding only).
</ParamField>

<ParamField body="keeperFundingSignature" type="string">
  Base58 signature for `keeperFundingTx`. **Required** whenever `/prepare` emitted a `keeperFundingTx` — omitting it returns `MH_039`.
</ParamField>

<ParamField body="orchestratorInitSignature" type="string">
  Base58 signature for `orchestratorInitTx`. Omit when that field was `null`.
</ParamField>

<ParamField body="sessionInitSignatures" type="array">
  Base58 signatures for each `sessionInitTxs` entry. Omit when empty.
</ParamField>

## Response

<ResponseField name="transfer" type="object">
  Updated transfer object. `status` becomes `processing` once the full bundle is recorded.
</ResponseField>

<RequestExample>
  ```bash cURL — intermediate call (after keeperFundingTx only) theme={null}
  curl -X POST /api/v1/transfers/42/confirm-broadcast \
    -H "x-api-key: mh_live_abc123..." \
    -H "Content-Type: application/json" \
    -H "Idempotency-Key: $(uuidgen)" \
    -d '{
      "routeInitSignatures": [],
      "keeperFundingSignature": "7hGpRt4bJm2Kx9Nv5aZqYe3uLk8dQ1P..."
    }'
  ```

  ```bash cURL — final call (after all remaining txs) theme={null}
  curl -X POST /api/v1/transfers/42/confirm-broadcast \
    -H "x-api-key: mh_live_abc123..." \
    -H "Content-Type: application/json" \
    -H "Idempotency-Key: $(uuidgen)" \
    -d '{
      "routeInitSignatures": ["4mGxFn7mN1KqQe6a..."],
      "orchestratorInitSignature": "2qYzLf1xJx4oRz9M...",
      "sessionInitSignatures": ["9rTpWx2aKm3Nv8Qz..."],
      "keeperFundingSignature": "7hGpRt4bJm2Kx9Nv..."
    }'
  ```
</RequestExample>

<ResponseExample>
  ```json 200 theme={null}
  {
    "transfer": {
      "id": 42,
      "status": "processing"
    }
  }
  ```

  ```json 400 theme={null}
  {
    "error": {
      "code": "MH_039",
      "message": "keeperFundingSignature is required"
    }
  }
  ```

  ```json 409 theme={null}
  {
    "error": {
      "code": "MH_035",
      "message": "Transfer is not in a state that allows broadcast confirmation"
    }
  }
  ```
</ResponseExample>
