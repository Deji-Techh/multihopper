# MH-DOC-012: OpenAPI does not model documented Bearer authentication

Severity: Documentation blocker

## Summary

The API Introduction says every endpoint accepts the API key either in `x-api-key` or as `Authorization: Bearer ...`. Live devnet confirms Bearer authentication works. However, OpenAPI only defines an `apiKey` security scheme for the `x-api-key` header. It does not define an HTTP bearer security scheme or a separate `Authorization` header parameter.

OpenAPI-generated SDKs and MCP tools will usually expose only the `x-api-key` auth path even though Bearer auth is documented and functional.

## What I Built Or Used

- Official docs snapshot from `https://dev-docs.multihopper.com`.
- Direct read-only devnet `GET /usage` check with the approved test key passed as a Bearer token.
- No API mutation.
- No private key was loaded.
- No transaction was signed or broadcast.

## Affected Flow

- OpenAPI-generated clients.
- MCP/API tool generation.
- Agents configured to use `Authorization: Bearer` instead of `x-api-key`.

## Steps To Reproduce

1. Read `reports/private/docs/api-reference/introduction.md`.
2. Observe the documented Bearer authentication example.
3. Inspect `components.securitySchemes` in `reports/private/docs/openapi.json`.
4. Call a read-only endpoint with `Authorization: Bearer <test key>`.
5. Observe that live API accepts Bearer auth, while OpenAPI does not model it.

## Evidence

Human docs:

```text
reports/private/docs/api-reference/introduction.md:23-30
All API endpoints require an API key. Pass it via the x-api-key header or as a Bearer token.
Authorization: Bearer mh_live_abc123...
```

OpenAPI security schemes:

```json
{
  "apiKey": {
    "type": "apiKey",
    "in": "header",
    "name": "x-api-key",
    "description": "API key prefixed with `mh_test_` (test mode) or `mh_live_` (live mode). Can also be passed as a Bearer token: `Authorization: Bearer mh_live_abc123...`"
  }
}
```

OpenAPI global security:

```json
[
  {
    "apiKey": []
  }
]
```

There is no `type: "http", scheme: "bearer"` security scheme.

Live API check:

```text
GET /usage
Authorization: Bearer <approved test key>
HTTP 200
isTestMode: true
```

## Expected Result

OpenAPI should model both supported authentication methods:

```json
{
  "securitySchemes": {
    "apiKey": {
      "type": "apiKey",
      "in": "header",
      "name": "x-api-key"
    },
    "bearerAuth": {
      "type": "http",
      "scheme": "bearer"
    }
  },
  "security": [
    { "apiKey": [] },
    { "bearerAuth": [] }
  ]
}
```

## Actual Result

OpenAPI only models `x-api-key`; Bearer auth appears only in a prose description string.

## Impact

Agent impact:

- Generated clients and MCP tools may not offer Bearer auth as a first-class option.
- Agents configured from OpenAPI alone may reject valid Bearer-token configuration or require a custom header override.
- Auth behavior differs between human docs and machine-readable docs.

Operational impact:

- Integrators using standard OpenAPI auth generation lose one documented auth mode.
- This adds friction to agent workflows where `Authorization` is often the default secret injection header.

## Proposed Fix

- Add a reusable `bearerAuth` HTTP security scheme.
- Set global `security` to allow either `{ apiKey: [] }` or `{ bearerAuth: [] }`.
- Keep the prose examples, but do not rely on descriptions for machine-readable auth semantics.
- Add a generated-client smoke test that verifies both auth styles can be configured from OpenAPI.

## Contact

TBD
