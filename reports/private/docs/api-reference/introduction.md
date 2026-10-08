> ## Documentation Index
> Fetch the complete documentation index at: https://dev-docs.multihopper.com/llms.txt
> Use this file to discover all available pages before exploring further.

# API Introduction

> Integrate with MultiHopper programmatically via the REST API

## Base URL

The API runs in two independent environments. Append `/api/v1` to the host for your environment:

| Environment          | Base URL                                |
| -------------------- | --------------------------------------- |
| Devnet (testing)     | `https://devnet.multihopper.com/api/v1` |
| Production (mainnet) | `https://multihopper.com/api/v1`        |

Use the **server dropdown** at the top of any endpoint page to switch the interactive examples
between them. See [Environments](/concepts/environments) for keys, clusters, and dashboards.

## Authentication

All API endpoints require an API key. Pass it via the `x-api-key` header or as a Bearer token.

```bash theme={null}
# Header authentication
x-api-key: mh_live_abc123...

# Or Bearer token
Authorization: Bearer mh_live_abc123...
```

API keys are prefixed to indicate mode:

| Prefix     | Mode                             |
| ---------- | -------------------------------- |
| `mh_test_` | Test mode — uses test accounting |
| `mh_live_` | Live mode — uses live accounting |

The Solana cluster (mainnet/devnet) depends on the environment the API is deployed against.

## Request format

Use JSON request bodies for `POST` requests and standard path/query parameters for `GET` and `DELETE` requests.

```
Content-Type: application/json
```

## Idempotency

All `POST` mutations require an `Idempotency-Key` header (8–64 characters, `[a-zA-Z0-9._-]`). Use a random UUID per request. Reusing a key with a different body returns `MH_071`.

```bash theme={null}
Idempotency-Key: a3f8c2e1-74b9-4d06-9832-15f0e7b3a129
```

| Code     | Description                                        | Status |
| -------- | -------------------------------------------------- | ------ |
| `MH_070` | Idempotency-Key header missing or invalid          | 400    |
| `MH_071` | Idempotency-Key reused with different request body | 409    |
| `MH_072` | Idempotency-Key request still in progress          | 409    |

## Error codes

All errors include a structured `MH_XXX` code for programmatic handling.

### Authentication

| Code     | Description                | Status |
| -------- | -------------------------- | ------ |
| `MH_001` | Invalid or missing API key | 401    |
| `MH_002` | API key revoked            | 401    |
| `MH_003` | Integration suspended      | 403    |
| `MH_004` | Rate limit exceeded        | 429    |

### Validation

| Code     | Description                                       | Status |
| -------- | ------------------------------------------------- | ------ |
| `MH_010` | Unsupported token mint or missing pricing context | 400    |
| `MH_011` | Invalid wallet address                            | 400    |
| `MH_012` | Amount below minimum                              | 400    |
| `MH_013` | Hops out of range (3–10)                          | 400    |
| `MH_014` | Arrival time below minimum for hop count          | 400    |
| `MH_015` | Invalid external ID format                        | 400    |

### Transfer lifecycle

| Code     | Description                                                  | Status |
| -------- | ------------------------------------------------------------ | ------ |
| `MH_030` | Transfer not found                                           | 404    |
| `MH_031` | Route creation failed                                        | 500    |
| `MH_032` | Funding not completed within timeout                         | 408    |
| `MH_033` | Transfer already exists (duplicate `externalId`)             | 409    |
| `MH_034` | Transfer expired                                             | 410    |
| `MH_035` | Transfer not in a state that allows broadcast confirmation   | 409    |
| `MH_036` | Broadcast signature not found on chain                       | 404    |
| `MH_037` | Broadcast transaction failed on chain                        | 422    |
| `MH_038` | Broadcast transaction did not invoke the MultiHopper program | 422    |
| `MH_039` | Keeper funding signature required but not provided           | 400    |

### Webhooks

| Code     | Description                   | Status |
| -------- | ----------------------------- | ------ |
| `MH_050` | Webhook URL unreachable       | 400    |
| `MH_051` | Max webhook endpoints reached | 400    |

### Recovery

| Code     | Description                                                 | Status |
| -------- | ----------------------------------------------------------- | ------ |
| `MH_080` | Recovery action not allowed in current transfer phase       | 409    |
| `MH_081` | Nothing to rescue — no rescuable accounts found             | 409    |
| `MH_082` | Nothing to reclaim — no reclaimable rent found              | 409    |
| `MH_083` | Provided rescue signatures do not match the prepared bundle | 400    |

### Reward claims

| Code     | Description                   | Status |
| -------- | ----------------------------- | ------ |
| `MH_060` | Below minimum claim threshold | 400    |
| `MH_061` | Rewards wallet not set        | 400    |

### Internal

| Code     | Description                     | Status |
| -------- | ------------------------------- | ------ |
| `MH_090` | Internal server error           | 500    |
| `MH_091` | Service temporarily unavailable | 503    |

## Rate limits

Rate limits are enforced per API key, per endpoint. When exceeded, the API returns `MH_004` with a `Retry-After` header.

| Endpoint                              | Limit  | Window |
| ------------------------------------- | ------ | ------ |
| `POST /transfers`                     | 10 req | 60s    |
| `POST /transfers/:id/funding/refresh` | 10 req | 60s    |
| `POST /transfers/:id/funding/confirm` | 10 req | 60s    |
| `POST /transfers/estimate`            | 30 req | 60s    |
| `GET /transfers/:id`                  | 60 req | 60s    |
| `GET /transfers`                      | 60 req | 60s    |
| `POST /webhooks`                      | 30 req | 60s    |
| `GET /webhooks`                       | 30 req | 60s    |
| `DELETE /webhooks/:id`                | 30 req | 60s    |
| `GET /usage`                          | 30 req | 60s    |

## Pricing

Pricing tiers are determined by the USD equivalent of the transfer at quote time. For native SOL, the backend resolves USD value from CoinGecko spot pricing. Fees are split between you (the integrator) and the platform.

<CardGroup cols={2}>
  <Card title="Estimate fees" icon="calculator" href="/api-reference/transfers/estimate">
    Check costs before creating a transfer.
  </Card>

  <Card title="Create transfer" icon="plus" href="/api-reference/transfers/create">
    Create a transfer and receive funding transactions.
  </Card>

  <Card title="Webhooks" icon="bell" href="/api-reference/webhooks/create">
    Receive real-time transfer lifecycle events.
  </Card>

  <Card title="Usage" icon="chart-bar" href="/api-reference/usage">
    View usage and fee summaries for your integration.
  </Card>
</CardGroup>
