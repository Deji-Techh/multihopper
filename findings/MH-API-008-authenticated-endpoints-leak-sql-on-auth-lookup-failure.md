# MH-API-008: Authenticated endpoints leak raw SQL and key hash on auth lookup failure

Severity: High

## Summary

Multiple authenticated read-only endpoints on devnet returned HTTP 500 with a raw SQL query and the API key hash parameter in the public response body during an auth lookup failure window. This reproduced across `GET /webhooks`, `GET /usage`, and `GET /transfers?limit=1`, using both `x-api-key` and `Authorization: Bearer` authentication.

The response exposes internal table names, column names, join structure, integration metadata fields, and a key hash value. It also makes every authenticated agent workflow fail before route creation, monitoring, webhook cleanup, or usage checks can run.

## What I Built Or Used

- Direct read-only devnet API checks with the approved test key.
- `x-api-key` and Bearer authentication variants.
- No private key was loaded.
- No transaction was signed or broadcast.
- No state-changing API request was used for this finding.
- A later smoke check recovered, which confirms this as a backend error-handling leak rather than a permanent endpoint outage.

## Affected Flow

- Authentication middleware or API-key lookup.
- All authenticated endpoints tested:
  - `GET /webhooks`
  - `GET /usage`
  - `GET /transfers?limit=1`
- Agent startup, status monitoring, usage checks, and webhook cleanup.

## Steps To Reproduce

1. Call `GET /usage` with the approved devnet test API key.
2. Call `GET /transfers?limit=1` with the same key.
3. Call `GET /webhooks` with the same key.
4. Repeat one call with `Authorization: Bearer <test key>` instead of `x-api-key`.
5. Observe each response returns HTTP 500 and exposes a raw SQL query containing `api_keys` and `integrations` fields.

## Evidence

Observed repeatedly at:

```text
2026-07-06T01:01:26+01:00
```

Initial read-only failure:

```text
GET /webhooks
HTTP 500
{
  "statusCode": 500,
  "error": "Internal Server Error",
  "message": "Failed query: select \"api_keys\".\"id\", \"api_keys\".\"integration_id\", ... from \"api_keys\" inner join \"integrations\" on \"api_keys\".\"integration_id\" = \"integrations\".\"id\" where \"api_keys\".\"key_hash\" = $1 limit $2\nparams: [redacted key hash],1"
}
```

Repeated across endpoints after a retry window:

```text
GET /usage
Authorization: x-api-key
HTTP 500
message: Failed query: select "api_keys"."id", "api_keys"."integration_id", "api_keys"."key_hash", ... where "api_keys"."key_hash" = $1 limit $2
params: [redacted key hash],1

GET /transfers?limit=1
Authorization: x-api-key
HTTP 500
message: Failed query: select "api_keys"."id", "api_keys"."integration_id", "api_keys"."key_hash", ... where "api_keys"."key_hash" = $1 limit $2
params: [redacted key hash],1

GET /usage
Authorization: Bearer <approved test key>
HTTP 500
message: Failed query: select "api_keys"."id", "api_keys"."integration_id", "api_keys"."key_hash", ... where "api_keys"."key_hash" = $1 limit $2
params: [redacted key hash],1
```

The leaked query includes internal columns such as:

```text
api_keys.key_hash
api_keys.key_prefix
api_keys.is_revoked
integrations.user_id
integrations.webhook_url
integrations.rewards_wallet
integrations.notification_email
integrations.provider_pda
integrations.provider_status
```

Later recovery control:

```text
2026-07-06T01:02:57+01:00

npm run audit:api:smoke
GET /usage
HTTP 200

GET /transfers?limit=1
HTTP 200
```

The same leak recurred during a later verification pass:

```text
2026-07-06T01:15:16+01:00

GET /webhooks
HTTP 500
message: Failed query: select "api_keys"."id", "api_keys"."integration_id", "api_keys"."key_hash", ... where "api_keys"."key_hash" = $1 limit $2
params: [redacted key hash],1

Retry after 15 seconds:
GET /webhooks
HTTP 200
{ "items": [] }
```

## Expected Result

Internal auth lookup failures should not be returned to API clients. A failing auth/database lookup should return a sanitized response:

```text
HTTP 500
{
  "error": {
    "code": "MH_500",
    "message": "Internal server error",
    "requestId": "..."
  }
}
```

If the API key is invalid or revoked, it should return a sanitized 401/403 response without exposing database details.

## Actual Result

- Authenticated endpoints returned HTTP 500.
- The public response body included raw SQL.
- The public response body included a key hash parameter.
- Both `x-api-key` and Bearer authentication paths failed the same way.

## Impact

Security impact:

- Internal schema, table names, column names, and join relationships are exposed.
- API key hash values are exposed to clients.
- Attackers can learn auth and integration data model details useful for targeted probing.

Agent reliability impact:

- Agents cannot perform basic read-only setup checks.
- Status monitoring and webhook cleanup fail before business logic runs.
- Error shape does not match the documented `MH_XXX` structure, so automated handlers cannot classify the failure.

## Proposed Fix

- Wrap authentication and integration lookup failures in a sanitized API error response.
- Never return raw database exception messages or query text to clients.
- Redact key hashes and internal identifiers from all public errors.
- Add regression tests that simulate auth lookup/database failures for:
  - `GET /usage`
  - `GET /transfers`
  - `GET /webhooks`
  - Bearer auth
  - `x-api-key` auth
- Ensure all 500 responses use the documented structured error shape with request IDs.

## Contact

TBD
