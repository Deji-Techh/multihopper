# MultiHopper Docs Reference

Fetched and reviewed on 2026-07-05 from:

- https://dev-docs.multihopper.com/
- https://dev-docs.multihopper.com/llms.txt
- https://dev-docs.multihopper.com/guides/agentic-integration
- https://dev-docs.multihopper.com/guides/mcp-server
- https://dev-docs.multihopper.com/api-reference/openapi.json

## Environment Model

Devnet:

- API base URL: `https://devnet.multihopper.com/api/v1`
- Dashboard: `https://devnet.multihopper.com/developer/dashboard`
- API keys: `mh_test_...` only
- Solana cluster: devnet
- Funds: devnet SOL and test tokens

Production:

- API base URL: `https://multihopper.com/api/v1`
- Dashboard: `https://multihopper.com/developer/dashboard`
- API keys: `mh_live_...` and `mh_test_...`
- Solana cluster: mainnet-beta
- Funds: real assets

Important: the key prefix alone does not switch clusters. A key is bound to the environment that minted it.

## Auth And Idempotency

Auth:

- `x-api-key: <key>`
- or `Authorization: Bearer <key>`

All POST mutations require:

- Header: `Idempotency-Key`
- Format: 8-64 chars, `[a-zA-Z0-9._-]`
- Reuse with different body returns `MH_071`
- In-progress duplicate returns `MH_072`
- Missing/invalid key returns `MH_070`

## Core Flow

The documented agentic transfer flow:

1. `POST /transfers`
2. `POST /transfers/{id}/prepare`
3. Sign and broadcast `keeperFundingTx` first.
4. Immediately `POST /transfers/{id}/confirm-broadcast` with:
   `{ "routeInitSignatures": [], "keeperFundingSignature": "..." }`
5. Sign and broadcast the rest in order:
   `routeInitTxs[0..N] -> orchestratorInitTx -> sessionInitTxs[0..N]`
6. Final `POST /transfers/{id}/confirm-broadcast` with remaining signatures.
7. `GET /transfers/{id}` until terminal status.

## Prepared Transaction Types

- `keeperFundingTx`: base64 VersionedTransaction v0. Broadcast first.
- `routeInitTxs[]`: base64 VersionedTransaction v0 entries, sometimes wrapped as `{ base64 }`. Server may pre-sign ephemeral keys.
- `orchestratorInitTx`: base64 legacy Transaction. Use partial signing.
- `sessionInitTxs[]`: base64 VersionedTransaction v0 entries. Server may pre-sign ephemeral keys.

Signing rule:

- Add the source owner signature without overwriting any existing server partial signatures.
- Any `null` prepared transaction field is already confirmed on-chain and must be skipped.

## Confirm Broadcast Rules

`confirm-broadcast` is normally called twice:

- Intermediate call immediately after `keeperFundingTx`.
- Final call after every remaining transaction is confirmed on-chain.

The endpoint only advances when it can verify the required on-chain state. If signatures are reported before transactions land, the route can remain stalled without a transition. The recovery path is to call `/prepare` again, sign non-null groups, broadcast, then confirm again.

## Expiry And Resume

Prepared transaction blockhashes expire roughly 60 seconds after `/prepare`.

On expiry, RPC failure, or process crash:

- Call `/prepare` again with a new `Idempotency-Key`.
- The server probes chain state and omits or nulls groups already completed on-chain.
- Sign and broadcast only the remaining groups.

## Status And Recovery

GET endpoints:

- `GET /transfers/{transferId}`
- `GET /transfers/by-external/{externalId}`
- `GET /transfers`

Statuses include:

- `quote`
- `awaiting_signature`
- `processing`
- `completed`
- `failed`
- `expired`
- `refunded`

Phases include:

- `quoted`
- `deploying`
- `executing`
- `settled`
- `failed`
- `recoverable`
- `rescued`
- `reclaimed`
- `expired`

Recovery endpoints in OpenAPI:

- `POST /transfers/{id}/rescue/prepare`
- `POST /transfers/{id}/rescue/confirm`
- `POST /transfers/{id}/reclaim-rent/prepare`
- `POST /transfers/{id}/reclaim-rent/confirm`

## Webhooks

Webhook create/list/delete endpoints:

- `POST /webhooks`
- `GET /webhooks`
- `DELETE /webhooks/{endpointId}`

Webhook signatures:

- Header: `x-multihopper-signature`
- Algorithm: HMAC-SHA256 over the raw request payload.
- Secret prefix: `whsec_`

Relevant events include transfer lifecycle updates, recoverable failure, rescue, and rent reclaim.
