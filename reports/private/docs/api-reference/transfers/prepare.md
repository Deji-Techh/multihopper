> ## Documentation Index
> Fetch the complete documentation index at: https://dev-docs.multihopper.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Prepare Transactions

> Build the unsigned transaction bundle for a transfer

Probes on-chain state and returns the full bundle of unsigned Solana transactions that `sourceOwner` must sign and broadcast to deploy the transfer.

This endpoint is **resumable** — re-call it after a partial broadcast to get a fresh blockhash and drop any groups already confirmed on-chain (`null` fields are already on chain, skip them).

<Note>
  On compliance-enabled networks (mainnet) the bundle includes a flat **0.002 SOL screening fee**
  transfer that runs at deploy. Ensure the `sourceOwner` wallet holds enough SOL to cover
  **route amount + protocol fees + account rent + keeper funding + the screening fee** before
  signing — the fee is **not** part of `/estimate`. It is a refundable anti-abuse deposit: a clean
  (verified) route gets it back, a flagged route forfeits it. Either way the wallet must hold it at
  deploy time. See [Compliance & screening](/concepts/compliance).
</Note>

## Path parameters

<ParamField path="transferId" type="integer" required>
  The internal transfer ID.
</ParamField>

## Response

<ResponseField name="transfer" type="object">
  Current transfer state.
</ResponseField>

<ResponseField name="preparedTxs" type="object">
  Bundle of unsigned transactions to sign and broadcast.

  <Expandable title="preparedTxs fields">
    <ResponseField name="preparedTxs.keeperFundingTx" type="string | null">
      **Broadcast FIRST.** Base64 VersionedTransaction that transfers SOL to the assigned keeper. `null` if keeper is already funded.
    </ResponseField>

    <ResponseField name="preparedTxs.routeInitTxs" type="array">
      Array of `{ base64 }` VersionedTransactions to initialize the on-chain route. Empty if route is already deployed.
    </ResponseField>

    <ResponseField name="preparedTxs.orchestratorInitTx" type="string | null">
      Base64 legacy Transaction to initialize the orchestrator config PDA. `null` if already initialized.
    </ResponseField>

    <ResponseField name="preparedTxs.sessionInitTxs" type="array">
      Array of base64 VersionedTransactions to initialize step state PDAs. Entries for already-initialized steps are omitted.
    </ResponseField>

    <ResponseField name="preparedTxs.recentBlockhash" type="string">
      Blockhash used to build these transactions. Sign and broadcast before this expires (\~60s).
    </ResponseField>

    <ResponseField name="preparedTxs.lastValidBlockHeight" type="integer">
      Last block height at which these transactions are valid.
    </ResponseField>

    <ResponseField name="preparedTxs.resume" type="object">
      Snapshot of on-chain state used to build the bundle.

      <Expandable title="resume fields">
        <ResponseField name="resume.routeAlreadyDeployed" type="boolean" />

        <ResponseField name="resume.existingHopCount" type="integer" />

        <ResponseField name="resume.totalHops" type="integer" />

        <ResponseField name="resume.orchestratorAlreadyInitialized" type="boolean" />

        <ResponseField name="resume.completedStepIndices" type="array">Indices of step PDAs already on-chain.</ResponseField>

        <ResponseField name="resume.totalSteps" type="integer" />

        <ResponseField name="resume.keeperAlreadyFunded" type="boolean" />

        <ResponseField name="resume.nothingToDo" type="boolean">
          `true` if all groups are null/empty — no signing needed.
        </ResponseField>
      </Expandable>
    </ResponseField>
  </Expandable>
</ResponseField>

<RequestExample>
  ```bash cURL theme={null}
  curl -X POST /api/v1/transfers/42/prepare \
    -H "x-api-key: mh_live_abc123..." \
    -H "Idempotency-Key: $(uuidgen)"
  ```
</RequestExample>

<ResponseExample>
  ```json 200 theme={null}
  {
    "transfer": { "id": 42, "status": "awaiting_signature" },
    "preparedTxs": {
      "keeperFundingTx": "AQAAAAAAAA...",
      "routeInitTxs": [{ "base64": "AQAAAAAAAA..." }],
      "orchestratorInitTx": null,
      "sessionInitTxs": ["AQAAAAAAAA...", "AQAAAAAAAA..."],
      "recentBlockhash": "BpFi8bTNRuLbUnrq7q1N1M...",
      "lastValidBlockHeight": 289043200,
      "resume": {
        "routeAlreadyDeployed": false,
        "existingHopCount": 0,
        "totalHops": 7,
        "orchestratorAlreadyInitialized": true,
        "completedStepIndices": [],
        "totalSteps": 7,
        "keeperAlreadyFunded": false,
        "nothingToDo": false
      }
    }
  }
  ```
</ResponseExample>
