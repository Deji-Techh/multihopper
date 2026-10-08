> ## Documentation Index
> Fetch the complete documentation index at: https://dev-docs.multihopper.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Create Transfer

> Create a new transfer quote

Creates a new transfer in `quote` status with locked-in pricing. Call `/prepare` next to get the unsigned transactions.

Idempotent via `externalId` — the same `externalId` returns the existing transfer rather than creating a duplicate.

<Note>
  On compliance-enabled networks the route is screened automatically after deployment and a flat
  **0.002 SOL screening fee** is charged at deploy. You don't take any action to pass screening —
  see [Compliance & screening](/concepts/compliance) for the lifecycle, funding impact, and what
  happens if a wallet is flagged.
</Note>

## Request body

<ParamField body="tokenMint" type="string" required>
  The Solana mint address of the token to transfer.
</ParamField>

<ParamField body="amountRaw" type="string" required>
  Raw token amount as a string (e.g. `"1000000000"` for 1 SOL).
</ParamField>

<ParamField body="amountTokens" type="string" required>
  Human-readable token amount (e.g. `"1.0"`).
</ParamField>

<ParamField body="sourceOwner" type="string" required>
  Solana public key of the wallet that will sign and pay for the deployment transactions.
</ParamField>

<ParamField body="recipientWallet" type="string" required>
  Solana public key of the final recipient.
</ParamField>

<ParamField body="tokenDecimals" type="integer" default="6">
  Decimal precision of the token (0–18).
</ParamField>

<ParamField body="tokenSymbol" type="string">
  Token symbol (e.g. `"SOL"`). Optional, used for display purposes.
</ParamField>

<ParamField body="hops" type="integer">
  Number of intermediate abstraction hops (3–10). Defaults to the integration setting.
</ParamField>

<ParamField body="arrivalSeconds" type="integer">
  Target transfer arrival time in seconds. Minimum: 60.
</ParamField>

<ParamField body="externalId" type="string">
  Your own identifier for idempotency (e.g. `"order_12345"`). Alphanumeric, `.`, `_`, `-` only.
</ParamField>

<ParamField body="tokenPriceUsd" type="number">
  Optional token price in USD. If not provided, resolved from Raydium spot pricing.
</ParamField>

## Response

<ResponseField name="id" type="integer">Internal transfer ID.</ResponseField>
<ResponseField name="externalId" type="string">Your external ID, if provided.</ResponseField>
<ResponseField name="supportBundleId" type="string">Human-readable support reference (e.g. `"MH-acme-42"`).</ResponseField>
<ResponseField name="tokenMint" type="string">Mint address of the token being transferred.</ResponseField>
<ResponseField name="amountRaw" type="string">Transfer amount in base units.</ResponseField>
<ResponseField name="amountTokens" type="string">Human-readable token amount.</ResponseField>
<ResponseField name="sourceOwner" type="string">Solana public key of the signing wallet.</ResponseField>
<ResponseField name="recipientWallet" type="string">Solana public key of the final recipient.</ResponseField>
<ResponseField name="fundingStrategy" type="string">Internal funding strategy (e.g. `"direct_orchestration"`).</ResponseField>
<ResponseField name="hops" type="integer">Number of abstraction hops.</ResponseField>
<ResponseField name="arrivalSeconds" type="integer">Target arrival time in seconds.</ResponseField>
<ResponseField name="pricingTier" type="string">Pricing tier applied.</ResponseField>
<ResponseField name="percentFeeBps" type="integer">Percentage fee in basis points.</ResponseField>
<ResponseField name="totalFlatFeeLamports" type="integer">Total flat fee in lamports.</ResponseField>
<ResponseField name="status" type="string">Transfer status. Initially `quote`.</ResponseField>
<ResponseField name="isTest" type="boolean">Whether created with a test-mode API key.</ResponseField>
<ResponseField name="quotedAt" type="string">ISO 8601 timestamp when pricing was quoted.</ResponseField>
<ResponseField name="expiresAt" type="string">ISO 8601 timestamp after which the transfer expires if not funded.</ResponseField>
<ResponseField name="createdAt" type="string">ISO 8601 creation timestamp.</ResponseField>

<RequestExample>
  ```bash cURL theme={null}
  curl -X POST /api/v1/transfers \
    -H "x-api-key: mh_live_abc123..." \
    -H "Content-Type: application/json" \
    -H "Idempotency-Key: $(uuidgen)" \
    -d '{
      "tokenMint": "So11111111111111111111111111111111111111112",
      "amountRaw": "1000000000",
      "amountTokens": "1.0",
      "tokenDecimals": 9,
      "tokenSymbol": "SOL",
      "sourceOwner": "Abc123...",
      "recipientWallet": "Def456...",
      "hops": 7,
      "arrivalSeconds": 300,
      "externalId": "order_12345"
    }'
  ```
</RequestExample>

<ResponseExample>
  ```json 200 theme={null}
  {
    "id": 42,
    "externalId": "order_12345",
    "supportBundleId": "MH-acme-42",
    "tokenMint": "So111...112",
    "amountRaw": "1000000000",
    "amountTokens": "1.0",
    "sourceOwner": "Abc123...",
    "recipientWallet": "Def456...",
    "fundingStrategy": "direct_orchestration",
    "hops": 7,
    "arrivalSeconds": 300,
    "pricingTier": "standard",
    "percentFeeBps": 50,
    "totalFlatFeeLamports": 42000,
    "status": "quote",
    "isTest": false,
    "quotedAt": "2025-01-15T10:30:00.000Z",
    "expiresAt": "2025-01-15T11:00:00.000Z",
    "createdAt": "2025-01-15T10:30:00.000Z"
  }
  ```

  ```json 409 theme={null}
  {
    "error": {
      "code": "MH_033",
      "message": "Transfer already exists for externalId 'order_12345'"
    }
  }
  ```
</ResponseExample>
