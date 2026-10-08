# MH-API-006: Validation and webhook errors use generic or wrong-domain codes instead of documented `MH_XXX` codes

Severity: Medium

## Summary

The API Introduction says all errors include a structured `MH_XXX` code for programmatic handling, and it documents specific validation codes such as `MH_011` for invalid wallet addresses and `MH_013` for hops outside the 3-10 range. In live devnet testing, schema validation errors from transfer and webhook endpoints returned generic `BAD_REQUEST` or framework-level codes instead. A low-amount create request returned `MH_016`, which is not listed in the published error-code table. A missing webhook endpoint returned the transfer-domain code `MH_030` with a "Transfer not found" prefix.

Agents that branch on documented error codes cannot reliably classify basic validation failures.

## What I Built Or Used

- Direct devnet API checks using the approved test key.
- `POST /transfers`.
- `POST /transfers/estimate`.
- `POST /webhooks`.
- `DELETE /webhooks/{endpointId}`.
- No private key was loaded.
- No transaction was signed or broadcast.

## Affected Flow

- Request validation.
- Agent retry/error classification.
- Create and estimate preflight.
- Webhook registration and deletion.
- Any OpenAPI/generated client or MCP tool expecting documented `MH_XXX` error codes.

## Steps To Reproduce

1. Call `POST /transfers/estimate` with `hops: 2`.
2. Call `POST /transfers/estimate` with `tokenMint: "bad"`.
3. Call `POST /transfers` with `hops: 2`.
4. Call `POST /transfers` with `sourceOwner: "bad"`.
5. Call `POST /transfers` with a tiny SOL amount.
6. Call `POST /webhooks` with malformed JSON.
7. Call `POST /webhooks` with JSON body but `Content-Type: text/plain`.
8. Call `DELETE /webhooks/notanint`.
9. Call `DELETE /webhooks/99999999`.
10. Compare returned error codes with the API Introduction error-code table.

## Evidence

Docs state:

```text
reports/private/docs/api-reference/introduction.md
All errors include a structured MH_XXX code for programmatic handling.

MH_011 Invalid wallet address
MH_012 Amount below minimum
MH_013 Hops out of range (3-10)
```

Estimate with invalid hops:

```text
POST /transfers/estimate
body.hops: 2
HTTP 400
error.code: BAD_REQUEST
error.message: hops: Number must be greater than or equal to 3
```

Estimate with invalid mint format:

```text
POST /transfers/estimate
body.tokenMint: bad
HTTP 400
error.code: BAD_REQUEST
error.message: tokenMint: String must contain at least 32 character(s)
```

Create transfer with invalid hops:

```text
POST /transfers
body.hops: 2
HTTP 400
error.code: BAD_REQUEST
error.message: hops: Number must be greater than or equal to 3
```

Create transfer with invalid source wallet:

```text
POST /transfers
body.sourceOwner: bad
HTTP 400
error.code: BAD_REQUEST
error.message: sourceOwner: String must contain at least 32 character(s)
```

Create transfer with too-small SOL amount:

```text
POST /transfers
body.amountRaw: 1
HTTP 400
error.code: MH_016
error.message: amountRaw must exceed totalFlatFeeLamports for SOL transfers...
```

`MH_016` is not listed in the API Introduction validation error table.

Webhook create with malformed JSON:

```text
POST /webhooks
Content-Type: application/json
body: {"url":

HTTP 400
{
  "statusCode": 400,
  "code": "FST_ERR_CTP_INVALID_JSON_BODY",
  "error": "Bad Request",
  "message": "Body is not valid JSON but content-type is set to 'application/json'"
}
```

This response is not wrapped in the documented `{ "error": { "code": "MH_XXX", ... } }` shape and has no requestId.

Webhook create with JSON body but wrong content type:

```text
POST /webhooks
Content-Type: text/plain
body: {"url":"https://example.com/mh-wrong-ct","events":["transfer.completed"]}

HTTP 400
error.code: BAD_REQUEST
error.message: Expected object, received string
```

Webhook delete with invalid endpoint ID:

```text
DELETE /webhooks/notanint
HTTP 400
error.code: BAD_REQUEST
error.message: endpointId: Expected number, received nan

DELETE /webhooks/-1
HTTP 400
error.code: BAD_REQUEST
error.message: endpointId: Number must be greater than 0
```

Webhook delete for a missing endpoint:

```text
DELETE /webhooks/99999999
HTTP 404
error.code: MH_030
error.message: Transfer not found — Webhook endpoint not found
```

`MH_030` is documented as a transfer lifecycle code, not a webhook deletion code.

## Expected Result

Validation failures should use documented `MH_XXX` codes consistently:

- Invalid wallet formats should return `MH_011`.
- Amount below minimum or non-positive hop amount should return `MH_012`, or `MH_016` should be documented.
- Hops outside 3-10 should return `MH_013`.
- Unsupported/invalid token mints should return `MH_010` or a documented mint-format code.
- Malformed JSON and content-type errors should be normalized into the documented structured error envelope.
- Invalid webhook endpoint IDs should return a documented webhook validation code.
- Missing webhook endpoints should return a webhook-specific not-found code or a generic resource-not-found code without a transfer-domain message.

## Actual Result

- Multiple validation paths return generic `BAD_REQUEST`.
- A low-amount create path returns undocumented `MH_016`.
- The error table does not match runtime behavior.
- Malformed JSON returns a framework-level `FST_ERR_CTP_INVALID_JSON_BODY`.
- Missing webhook endpoint deletion returns transfer-domain `MH_030` with a "Transfer not found" prefix.

## Impact

Agent impact:

- Agents cannot reliably choose whether to adjust parameters, ask the user for a different wallet, retry later, or stop.
- Generated clients and MCP tools that map known `MH_XXX` codes lose programmatic handling for common validation failures.
- Generic `BAD_REQUEST` violates the documented contract that all errors include structured `MH_XXX` codes.
- Webhook cleanup automation may classify a missing webhook as a missing transfer and run the wrong recovery path.

Operational impact:

- Integrators must parse human-readable validation strings, which is fragile and localization/version sensitive.
- Error dashboards cannot group validation failures by stable documented code.

## Proposed Fix

- Map all schema and business validation errors to documented `MH_XXX` codes.
- Add `MH_016` to the public error table if it is intentional.
- Add regression tests for:
  - invalid wallet -> `MH_011`,
  - low amount -> documented amount code,
  - hops outside range -> `MH_013`,
  - invalid token mint -> documented mint code.
- Normalize malformed JSON/content-type errors before sending responses to clients.
- Add webhook-specific error codes for invalid endpoint IDs and missing webhook endpoints.
- Avoid exposing framework-level `BAD_REQUEST` as the public `error.code`.

## Contact

TBD
