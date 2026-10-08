# MultiHopper Bounty Submission Pack

Use this as the source for the Google Doc / Notion submission.

Google Doc submission: `https://docs.google.com/document/d/10bUcLL7vrBiu2xgm4aAvi7NVam6Ps7bSV59Vc0O7WcQ`

## Recommended Submission Order

1. `MH-API-001` - High
   Transfer advances to `processing` without signed broadcasts or `confirm-broadcast`.
   File: `findings/MH-API-001-prepare-advances-transfer-to-processing-without-confirm-broadcast.md`

2. `MH-API-011` - High
   Expired transfer still returns a fresh prepare transaction bundle.
   File: `findings/MH-API-011-expired-transfer-prepare-returns-fresh-transaction-bundle.md`

3. `MH-API-005` - High
   Idempotency cache replays responses across different actions for the same transfer.
   File: `findings/MH-API-005-idempotency-key-replays-responses-across-different-actions.md`

4. `MH-API-008` - High
   Authenticated endpoints leak raw SQL and a key hash on auth lookup failure.
   File: `findings/MH-API-008-authenticated-endpoints-leak-sql-on-auth-lookup-failure.md`

5. `MH-API-002` - Medium
   `POST /transfers` without `Idempotency-Key` returns 500 and leaks internal SQL details.
   File: `findings/MH-API-002-create-without-idempotency-returns-500-sql-leak.md`

6. `MH-API-004` - Medium
   Expired/stuck transfer remains `active/executing` while rescue is already actionable.
   File: `findings/MH-API-004-expired-transfer-remains-active-while-rescue-is-actionable.md`

7. `MH-API-003` - Medium
   Full live devnet flow returns undocumented `active` status and misleading progress/signature fields.
   File: `findings/MH-API-003-live-flow-returns-undocumented-active-status-and-misleading-progress.md`

8. `MH-API-006` - Medium
   Validation and webhook errors use generic or wrong-domain codes instead of documented `MH_XXX` codes.
   File: `findings/MH-API-006-validation-errors-use-bad-request-and-undocumented-codes.md`

9. `MH-API-007` - Medium
   Webhook registration accepts plaintext HTTP callback URLs despite the HTTPS contract.
   File: `findings/MH-API-007-webhook-registration-accepts-http-url.md`

10. `MH-API-009` - Medium
   Webhook registration accepts unreachable callback URLs despite documented `MH_050`.
   File: `findings/MH-API-009-webhook-registration-accepts-unreachable-url.md`

11. `MH-API-010` - Medium
   Duplicate webhook registrations for the same URL and events create multiple active endpoints.
   File: `findings/MH-API-010-duplicate-webhook-registrations-for-same-url-events.md`

12. `MH-DOC-002` - High / Documentation blocker
   Agentic autonomous examples default to production/mainnet.
   File: `findings/MH-DOC-002-agentic-examples-default-production.md`

13. `MH-DOC-001` - Documentation blocker
   Quickstart copy-paste flow omits required idempotency headers and hides the intermediate confirm call.
   File: `findings/MH-DOC-001-quickstart-idempotency-two-step-confirm.md`

14. `MH-DOC-004` - Documentation blocker
   Create transfer status is documented inconsistently as `quote` and `awaiting_signature`.
   File: `findings/MH-DOC-004-create-status-inconsistent.md`

15. `MH-DOC-005` - Documentation blocker
   PreparedTxBundle nullability is inconsistent for resumed route/session arrays.
   File: `findings/MH-DOC-005-prepared-bundle-nullability-inconsistent.md`

16. `MH-DOC-003` - Low / Documentation blocker
   Agent context omits reclaim-rent recovery tools.
   File: `findings/MH-DOC-003-agent-context-omits-reclaim-rent.md`

17. `MH-DOC-006` - Low / Documentation blocker
   `externalId` duplicate behavior is underdocumented for same-body vs conflicting-body retries.
   File: `findings/MH-DOC-006-external-id-idempotency-conflict-docs.md`

18. `MH-DOC-007` - Documentation blocker
   Webhook create docs omit required idempotency header and list stale event types.
   File: `findings/MH-DOC-007-webhook-create-docs-missing-idempotency-and-events.md`

19. `MH-DOC-008` - Low / Documentation blocker
   `funding` and `partially_deployed` phases appear in OpenAPI but are omitted from human status docs and agent context.
   File: `findings/MH-DOC-008-phase-funding-omitted-from-human-docs.md`

20. `MH-DOC-009` - Documentation blocker
   OpenAPI omits the required `Idempotency-Key` header on mutating POST operations.
   File: `findings/MH-DOC-009-openapi-omits-idempotency-key-header.md`

21. `MH-DOC-013` - Documentation blocker
   Webhook delete requires `Idempotency-Key`, but docs and OpenAPI omit it.
   File: `findings/MH-DOC-013-webhook-delete-idempotency-omitted.md`

22. `MH-DOC-014` - Documentation blocker
   OpenAPI `listWebhooks` includes a `secret` field that human docs and live API omit.
   File: `findings/MH-DOC-014-openapi-list-webhooks-includes-secret-field.md`

23. `MH-DOC-010` - Documentation blocker
   Webhook signature verification example hashes parsed `req.body` and can throw on malformed signatures.
   File: `findings/MH-DOC-010-webhook-signature-example-uses-parsed-body-and-can-throw.md`

24. `MH-DOC-011` - Documentation blocker
   Estimate docs omit SOL budgeting fields and conflict with live `screeningFeeLamports` output.
   File: `findings/MH-DOC-011-estimate-docs-omit-sol-budgeting-and-conflict-on-screening-fee.md`

25. `MH-DOC-012` - Documentation blocker
   OpenAPI does not model documented Bearer authentication.
   File: `findings/MH-DOC-012-openapi-does-not-model-bearer-auth.md`

## What Was Built

- A TypeScript devnet-only MultiHopper audit harness.
- Safe docs fetch/check scripts.
- Offline Solana transaction-signing integrity checks.
- Read-only and prepare-only API probes.
- Guarded live devnet transfer runner that refuses to broadcast without explicit flags and devnet config.

## Commands Used For Evidence

```bash
npm run docs:fetch
npm run docs:check
npm run audit:dry-run
npm run audit:api:smoke
npm run audit:create-probe
npm run audit:prepare-probe
npm run audit:get-transfer
npm run audit:api-behavior
npm run audit:live-devnet
curl POST /transfers/908/rescue/prepare
curl POST /transfers/910/prepare after expiresAt
curl cross-endpoint idempotency replay checks
curl validation error code probes
curl/webhook malformed JSON and delete error code probes
curl GET /usage with Authorization: Bearer
curl POST /webhooks with plaintext HTTP URL
curl DELETE /webhooks/{endpointId} with and without Idempotency-Key
curl GET /usage, /transfers, and /webhooks auth SQL leak checks
node webhook create/list/delete secret-shape probe
node webhook unreachable .invalid URL probe
node duplicate webhook URL/events probe
```

API key was passed through environment variables only and was not written to files.

## Live Broadcast Status

Signed live devnet broadcast has been run once for transfer `908`.

Local CLI wallet:

- `GrbnzU4RZmMC8AfYBJDx7s2WkARxpJev5t8SCn5WUKjw`

The live runner remains guarded by:

- `ALLOW_LIVE_BROADCAST=true`
- `APPROVED_TEST_WALLET=true`
- devnet API base URL
- devnet RPC URL
- `mh_test_` key prefix

## Submission Notes

- Do not include the API key in the public report.
- Keep the key-hash value from `MH-API-002` redacted.
- Keep the key-hash value from `MH-API-008` redacted.
- Keep webhook signing secrets redacted.
- Add the submitter contact handle before final submission.
- The strongest finding is `MH-API-001`; submit it first if only one issue can be submitted.
