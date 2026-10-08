# MH-API-002: `POST /transfers` without `Idempotency-Key` returns 500 and leaks internal SQL details

Severity: Medium

## Summary

The API Introduction says all POST mutations require `Idempotency-Key` and should return `MH_070` when the header is missing or invalid. On devnet, `POST /transfers` without `Idempotency-Key` returned `500 Internal Server Error` instead. The response body included a raw SQL query against `api_keys` and `integrations`, many internal column names, and a query parameter that appears to be an API key hash.

This is both an agent reliability issue and an information disclosure issue. Agents following the Quickstart currently omit this header, and instead of receiving the documented actionable `MH_070`, they can receive an opaque 500 with internal implementation details.

## What I Built Or Used

- TypeScript audit harness in `/home/DejiTech/multihopper`.
- MultiHopper devnet API with test-mode key.
- Script: `npm run audit:api-behavior`.
- No private key was loaded.
- No Solana transaction was signed or broadcast.

## Affected Flow

- `POST /transfers`
- Idempotency validation.
- Error handling and response sanitization.
- Agentic create-transfer retry behavior.

## Steps To Reproduce

1. Send `POST /transfers` to devnet with a valid `x-api-key`.
2. Include a valid JSON transfer create body.
3. Omit the `Idempotency-Key` header.
4. Observe the response.

The harness reproduces this with:

```bash
MULTIHOPPER_API_KEY=<mh_test_key> \
SOURCE_OWNER=<devnet_wallet_pubkey> \
npm run audit:api-behavior
```

The relevant probe is `missing idempotency on create`.

## Evidence

Observed response:

```text
POST /transfers
Idempotency-Key: omitted
status: 500
body.statusCode: 500
body.error: Internal Server Error
body.message: Failed query: select "api_keys"."id", "api_keys"."integration_id",
  "api_keys"."key_hash", "api_keys"."key_prefix", ...,
  "integrations"."provider_pda", "integrations"."provider_status",
  "integrations"."register_signature", ...
  from "api_keys" inner join "integrations"
  on "api_keys"."integration_id" = "integrations"."id"
  where "api_keys"."key_hash" = $1 limit $2
params: [redacted-hash],1
```

Repeated behavior:

- The same missing-idempotency create probe returned 500 in consecutive behavior probe runs.
- `POST /transfers/{id}/prepare` without idempotency returned the documented `400 MH_070`.
- `POST /transfers/{id}/confirm-broadcast` without idempotency returned the documented `400 MH_070`.

Docs evidence:

- `reports/private/docs/api-reference/introduction.md:52` says all POST mutations require `Idempotency-Key`.
- `reports/private/docs/api-reference/introduction.md:60` says missing or invalid idempotency key returns `MH_070` with status 400.

## Expected Result

`POST /transfers` without `Idempotency-Key` should return a structured 400:

```json
{
  "error": {
    "code": "MH_070",
    "message": "Idempotency-Key header missing or invalid"
  }
}
```

It should not expose database queries, schema names, column names, or key-hash parameters.

## Actual Result

The create endpoint returns:

- HTTP 500
- `Internal Server Error`
- raw SQL text
- internal table/column names
- a key-hash parameter value, redacted in this report

## Impact

Agent impact:

- Agents cannot classify the error using the documented `MH_070` code.
- Retry logic may treat this as transient server failure rather than a client header issue.
- The Quickstart currently omits this header, so this is easy for an agent to trigger.

Security impact:

- Error responses disclose internal schema and query structure.
- The response includes a derived key hash parameter, which should not be returned to clients even if it is not the raw API key.

## Proposed Fix

- Validate `Idempotency-Key` for `POST /transfers` before executing create logic.
- Return `400 MH_070` for missing or invalid headers, matching `/prepare` and `/confirm-broadcast`.
- Add a global error filter that converts database exceptions into generic `MH_090`/`MH_091` style responses without SQL text or parameters.
- Add regression tests:
  - `POST /transfers` missing `Idempotency-Key` returns `400 MH_070`.
  - No error response contains SQL text, table names, or query parameters.

## Contact

TBD
