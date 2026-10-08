> ## Documentation Index
> Fetch the complete documentation index at: https://dev-docs.multihopper.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Quickstart

> Send your first multi-hop transfer in minutes

## Prerequisites

* A MultiHopper API key (`mh_test_...` for devnet/testing, `mh_live_...` for production)
* A Solana wallet with funds to transfer (devnet SOL is free)

Create your key from the dashboard of the environment you're building against — keys are
**not** interchangeable between environments. New to MultiHopper? Start on devnet.

<CardGroup cols={2}>
  <Card title="Get devnet test keys" icon="flask" href="https://devnet.multihopper.com/developer/dashboard">
    Build and test against Solana devnet — issues `mh_test_` keys. Recommended to start here.
  </Card>

  <Card title="Get production keys" icon="key" href="https://multihopper.com/developer/dashboard">
    Go live on mainnet — issues `mh_live_` keys.
  </Card>
</CardGroup>

<Note>
  Base URLs differ per environment (`https://devnet.multihopper.com` vs `https://multihopper.com`).
  The examples below use relative paths — prefix them with your environment's base URL. See
  [Environments](/concepts/environments) for the full table.
</Note>

## Transfer flow overview

Creating a transfer takes three API calls, plus an intermediate confirmation step:

```
1. POST /transfers                        → create transfer, receive a quote
2. POST /transfers/:id/prepare            → get serialized transaction bundles
   [sign + broadcast keeperFundingTx FIRST]
   POST /transfers/:id/confirm-broadcast  → record keeperFundingSignature immediately
   [sign + broadcast remaining txs in order]
3. POST /transfers/:id/confirm-broadcast  → submit remaining signatures, trigger deployment
```

Once confirmed, the transfer moves into processing automatically.

## Step 1: Estimate fees (optional)

Check expected costs before creating the transfer.

```bash theme={null}
curl -X POST /api/v1/transfers/estimate \
  -H "x-api-key: mh_test_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "tokenMint": "So11111111111111111111111111111111111111112",
    "amountRaw": "1000000000",
    "tokenDecimals": 9,
    "hops": 7
  }'
```

```json theme={null}
{
  "tier": "standard",
  "percentFeeBps": 50,
  "totalFlatFeeLamports": 42000,
  "usdEquivalent": 1502.50
}
```

## Step 2: Create the transfer

```bash theme={null}
curl -X POST /api/v1/transfers \
  -H "x-api-key: mh_test_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "tokenMint": "So11111111111111111111111111111111111111112",
    "amountRaw": "1000000000",
    "amountTokens": "1.0",
    "tokenDecimals": 9,
    "tokenSymbol": "SOL",
    "sourceOwner": "<YOUR_WALLET>",
    "recipientWallet": "<RECIPIENT_WALLET>",
    "hops": 7,
    "arrivalSeconds": 300,
    "externalId": "my-order-001"
  }'
```

The response includes the quoted transfer object with a `status` of `awaiting_signature`.

## Step 3: Prepare transactions

Call `prepare` to receive the serialized transaction bundles for this transfer:

```bash theme={null}
curl -X POST /api/v1/transfers/42/prepare \
  -H "x-api-key: mh_test_abc123..."
```

```json theme={null}
{
  "transfer": { "...": "..." },
  "preparedTxs": {
    "routeInitTxs": [{ "base64": "AQAAAA..." }],
    "orchestratorInitTx": "AQAAAA...",
    "sessionInitTxs": ["AQAAAA..."],
    "keeperFundingTx": "AQAAAA...",
    "recentBlockhash": "5eykt4...",
    "lastValidBlockHeight": 291182440
  }
}
```

Sign each transaction in the bundle using your wallet and submit them to Solana. Record the resulting signatures.

## Step 4: Confirm broadcast

Submit the collected signatures to confirm the broadcast:

```bash theme={null}
curl -X POST /api/v1/transfers/42/confirm-broadcast \
  -H "x-api-key: mh_test_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "routeInitSignatures": ["4mGxFn7m..."],
    "orchestratorInitSignature": "2qYzLf1x...",
    "sessionInitSignatures": ["7nKpQr3z..."],
    "keeperFundingSignature": "9vLmXt8w..."
  }'
```

The transfer status moves to `processing` and the keeper network takes over deployment.

## Step 5: Monitor status

```bash theme={null}
curl /api/v1/transfers/42 \
  -H "x-api-key: mh_test_abc123..."
```

Or receive real-time updates by [registering a webhook](/api-reference/webhooks).

## Next steps

<Columns cols={2}>
  <Card title="API Reference" icon="terminal" href="/api-reference/introduction">
    Full documentation for all endpoints, error codes, and rate limits.
  </Card>

  <Card title="Webhooks" icon="bell" href="/api-reference/webhooks/events">
    Receive real-time transfer lifecycle events.
  </Card>

  <Card title="How it works" icon="gears" href="/protocol/how-it-works">
    Understand the on-chain abstraction mechanism.
  </Card>

  <Card title="Security model" icon="shield-halved" href="/concepts/security">
    Trust assumptions and on-chain guarantees.
  </Card>
</Columns>
