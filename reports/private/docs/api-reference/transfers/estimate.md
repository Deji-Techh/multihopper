> ## Documentation Index
> Fetch the complete documentation index at: https://dev-docs.multihopper.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Estimate Fees

> Estimate fees for a potential transfer without creating one

Use this endpoint to show users expected costs before they confirm a transfer.

<Warning>
  **This estimate does not include the compliance screening fee.** On networks where the
  compliance gate is enabled (mainnet today), each deploy also collects a flat refundable
  **screening deposit (currently 0.002 SOL on mainnet)** from the signing wallet, charged by the
  `/prepare` bundle. Add it on top of the
  fees returned here when budgeting how much SOL the `sourceOwner` wallet must hold, otherwise the
  deploy can fail for insufficient lamports. See [Compliance & screening](/concepts/compliance).
</Warning>

## Request body

<ParamField body="tokenMint" type="string" required>
  The Solana mint address of the token to transfer.
</ParamField>

<ParamField body="amountRaw" type="string" required>
  Raw token amount as a string (e.g. `"1000000000"` for 1 SOL).
</ParamField>

<ParamField body="tokenDecimals" type="integer" default="6">
  Decimal precision of the token. Defaults to 6.
</ParamField>

<ParamField body="hops" type="integer" default="7">
  Number of intermediate abstraction hops. Range: 3–10. Defaults to 7.
</ParamField>

## Response

<ResponseField name="tier" type="string">
  Pricing tier determined by the USD equivalent of the transfer.
</ResponseField>

<ResponseField name="percentFeeBps" type="integer">
  Percentage fee in basis points.
</ResponseField>

<ResponseField name="percentFeeRaw" type="string">
  Percentage fee in raw token units.
</ResponseField>

<ResponseField name="flatFeeLamportsPerHop" type="integer">
  Flat fee in lamports charged per hop.
</ResponseField>

<ResponseField name="totalFlatFeeLamports" type="integer">
  Total flat fee in lamports across all hops.
</ResponseField>

<ResponseField name="integratorPercentShare" type="string">
  Integrator's share of the percentage fee in raw token units.
</ResponseField>

<ResponseField name="integratorFlatShare" type="integer">
  Integrator's share of the flat fee in lamports.
</ResponseField>

<ResponseField name="usdEquivalent" type="number">
  USD equivalent of the transfer amount at quote time (used for tier selection).
</ResponseField>

<ResponseField name="isTestMode" type="boolean">
  Whether this estimate was made with a test-mode API key.
</ResponseField>

<RequestExample>
  ```bash cURL theme={null}
  curl -X POST /api/v1/transfers/estimate \
    -H "x-api-key: mh_live_abc123..." \
    -H "Content-Type: application/json" \
    -d '{
      "tokenMint": "So11111111111111111111111111111111111111112",
      "amountRaw": "1000000000",
      "tokenDecimals": 9,
      "hops": 7
    }'
  ```
</RequestExample>

<ResponseExample>
  ```json 200 theme={null}
  {
    "tier": "standard",
    "percentFeeBps": 50,
    "percentFeeRaw": "500000",
    "flatFeeLamportsPerHop": 6000,
    "totalFlatFeeLamports": 42000,
    "integratorPercentShare": "250000",
    "integratorFlatShare": 21000,
    "usdEquivalent": 1502.50,
    "isTestMode": false
  }
  ```
</ResponseExample>
