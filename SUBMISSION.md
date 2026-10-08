# Superteam Earn Submission Packet

## Listing

Break It Before Users Do: MultiHopper Agentic Flow Bugs & Fixes

## Contact

GitHub: `Deji-Tech`. Add Superteam, Telegram, Discord, X, or email handle if different before final submission.

## Repository / Code Access

Private GitHub repository: `https://github.com/Deji-Tech/multihopper-agentic-audit`

Google Doc submission: `https://docs.google.com/document/d/10bUcLL7vrBiu2xgm4aAvi7NVam6Ps7bSV59Vc0O7WcQ`

Local workspace: `/home/DejiTech/multihopper`

## What Was Built Or Used

- A TypeScript/Node.js devnet-only audit harness for the documented MultiHopper agentic transfer flow.
- Official documentation snapshot from `https://dev-docs.multihopper.com`.
- OpenAPI inspection checks in `src/docsCheck.ts`.
- Offline transaction-signing and broadcast-order safety checks in `src/dryRun.ts`.
- Read-only and prepare-only API probes.
- One guarded live devnet transfer runner, used once for transfer `908`, with explicit devnet-only broadcast gates.
- Direct cURL/Node probes for webhook, idempotency, auth, validation, expiry, and recovery behavior.

Environment details:

- MultiHopper API base: `https://devnet.multihopper.com/api/v1`
- Solana RPC: `https://api.devnet.solana.com`
- Test wallet: `GrbnzU4RZmMC8AfYBJDx7s2WkARxpJev5t8SCn5WUKjw`
- API key: approved test key, never committed
- Private keys/seed phrases: never written to files or reports

## Recommended Submission Order

Submit the API/runtime findings first. They have the strongest impact on security, fund safety, route reliability, and agentic execution.

1. `MH-API-001` - High
2. `MH-API-011` - High
3. `MH-API-005` - High
4. `MH-API-008` - High
5. `MH-API-002` - Medium
6. `MH-API-004` - Medium
7. `MH-API-003` - Medium
8. `MH-API-006` - Medium
9. `MH-API-007` - Medium
10. `MH-API-009` - Medium
11. `MH-API-010` - Medium

Documentation blockers can be submitted as individual findings or as a grouped documentation-quality appendix.

## Findings

### MH-API-001: Transfer advances to `processing` without signed broadcasts or `confirm-broadcast`

Severity: High

Full report: [findings/MH-API-001-prepare-advances-transfer-to-processing-without-confirm-broadcast.md](findings/MH-API-001-prepare-advances-transfer-to-processing-without-confirm-broadcast.md)

Affected flow: `POST /transfers`, `POST /transfers/{id}/prepare`, `GET /transfers/{id}`, status monitoring.

Impact on agentic usage: Agents can think MultiHopper/keepers have taken over even though the client has not signed, broadcast, or confirmed anything. This can stall transfers, produce false monitoring state, and mislead recovery logic.

Evidence summary: Transfers `898`, `907`, and `910` moved to `processing/deploying` with empty signature arrays and prepare resume flags showing nothing deployed or funded.

Proposed fix: Gate `processing` on valid final `confirm-broadcast` and verified on-chain deployment state; keep prepare-only transfers in a pre-broadcast state.

### MH-API-011: Expired transfer still returns a fresh prepare transaction bundle

Severity: High

Full report: [findings/MH-API-011-expired-transfer-prepare-returns-fresh-transaction-bundle.md](findings/MH-API-011-expired-transfer-prepare-returns-fresh-transaction-bundle.md)

Affected flow: `POST /transfers/{id}/prepare`, expiry handling, resume behavior.

Impact on agentic usage: A resumed agent can sign and broadcast stale work after `expiresAt`, spending SOL/rent on an expired transfer that should be terminal or recovery-only.

Evidence summary: Transfer `910` expired at `2026-07-05T19:57:17.630Z`, but more than five hours later `POST /transfers/910/prepare` returned a fresh full transaction bundle.

Proposed fix: Check `expiresAt` before generating prepare bundles and return `MH_034` or a documented recovery-only response.

### MH-API-005: Idempotency cache replays responses across different actions for the same transfer

Severity: High

Full report: [findings/MH-API-005-idempotency-key-replays-responses-across-different-actions.md](findings/MH-API-005-idempotency-key-replays-responses-across-different-actions.md)

Affected flow: `/prepare`, `/rescue/prepare`, idempotent retry handling.

Impact on agentic usage: A reused idempotency key can cause an agent to receive the wrong response shape from a different endpoint, confusing normal deployment and recovery flows.

Evidence summary: Same transfer plus same idempotency key replayed prepare responses from rescue endpoints and rescue responses from prepare endpoints.

Proposed fix: Scope idempotency records by integration, HTTP method, route template/action, transfer ID, and body hash.

### MH-API-008: Authenticated endpoints leak raw SQL and key hash on auth lookup failure

Severity: High

Full report: [findings/MH-API-008-authenticated-endpoints-leak-sql-on-auth-lookup-failure.md](findings/MH-API-008-authenticated-endpoints-leak-sql-on-auth-lookup-failure.md)

Affected flow: auth middleware, `GET /usage`, `GET /transfers`, `GET /webhooks`.

Impact on agentic usage: Internal schema and API key hash details leak to clients during transient auth lookup failures; agents also receive undocumented 500 shapes and cannot classify failures.

Evidence summary: Read-only endpoints returned HTTP 500 with raw SQL over `api_keys` and `integrations`, including a key hash parameter. The key hash is redacted in reports.

Proposed fix: Sanitize all auth/database exceptions and return documented `MH_090` style errors with request IDs only.

### MH-API-002: `POST /transfers` without `Idempotency-Key` returns 500 and leaks SQL details

Severity: Medium

Full report: [findings/MH-API-002-create-without-idempotency-returns-500-sql-leak.md](findings/MH-API-002-create-without-idempotency-returns-500-sql-leak.md)

Affected flow: transfer creation, idempotency onboarding.

Impact on agentic usage: Agents that follow copy-paste examples without idempotency receive a server error and internal SQL details instead of actionable `MH_070`.

Evidence summary: Missing `Idempotency-Key` on `POST /transfers` returned HTTP 500 and raw query details.

Proposed fix: Validate idempotency before persistence and always return `400 MH_070` without internal details.

### MH-API-004: Expired/stuck transfer remains `active/executing` while rescue is actionable

Severity: Medium

Full report: [findings/MH-API-004-expired-transfer-remains-active-while-rescue-is-actionable.md](findings/MH-API-004-expired-transfer-remains-active-while-rescue-is-actionable.md)

Affected flow: status polling, recovery decision logic, `rescue/prepare`.

Impact on agentic usage: Agents receive contradictory signals: the route appears active/executing, but rescue is already possible.

Evidence summary: Transfer `908` remained `active/executing` after expiry with `recovery.canRescue: true`; `rescue/prepare` returned a valid rescue transaction bundle.

Proposed fix: Move expired rescuable transfers into a documented recovery state with structured `lastError`.

### MH-API-003: Live flow returns undocumented `active` status and misleading progress/signature fields

Severity: Medium

Full report: [findings/MH-API-003-live-flow-returns-undocumented-active-status-and-misleading-progress.md](findings/MH-API-003-live-flow-returns-undocumented-active-status-and-misleading-progress.md)

Affected flow: full live devnet flow, transfer listing, OpenAPI status filters.

Impact on agentic usage: Agents generated from OpenAPI do not know about `active`; progress fields and signatures can misrepresent what was requested and broadcast.

Evidence summary: Transfer `908` returned `status: active`; OpenAPI status enum omitted `active`; progress returned five total hops/steps despite a three-hop request.

Proposed fix: Add `active` to docs/OpenAPI or use documented statuses consistently; clarify progress semantics.

### MH-API-006: Validation and webhook errors use generic or wrong-domain codes

Severity: Medium

Full report: [findings/MH-API-006-validation-errors-use-bad-request-and-undocumented-codes.md](findings/MH-API-006-validation-errors-use-bad-request-and-undocumented-codes.md)

Affected flow: transfer validation, estimate validation, webhook create/delete errors.

Impact on agentic usage: Agents cannot reliably classify whether to adjust parameters, retry, ask the user, or stop.

Evidence summary: Invalid hops/wallet/mint returned `BAD_REQUEST`; malformed webhook JSON returned a framework code; missing webhook delete returned `MH_030 Transfer not found`.

Proposed fix: Normalize all validation and parse errors into documented `MH_XXX` codes and add webhook-specific error codes.

### MH-API-007: Webhook registration accepts plaintext HTTP callback URLs

Severity: Medium

Full report: [findings/MH-API-007-webhook-registration-accepts-http-url.md](findings/MH-API-007-webhook-registration-accepts-http-url.md)

Affected flow: `POST /webhooks`, webhook monitoring.

Impact on agentic usage: Agents can register insecure webhook endpoints despite the HTTPS-only docs, exposing lifecycle payloads over plaintext HTTP.

Evidence summary: `http://example.com/webhook` returned HTTP 200, active webhook, and a signing secret; the test endpoint was deleted afterward.

Proposed fix: Enforce `https:` server-side and return a documented validation code for plaintext URLs.

### MH-API-009: Webhook registration accepts unreachable callback URLs despite documented `MH_050`

Severity: Medium

Full report: [findings/MH-API-009-webhook-registration-accepts-unreachable-url.md](findings/MH-API-009-webhook-registration-accepts-unreachable-url.md)

Affected flow: `POST /webhooks`, webhook monitoring health.

Impact on agentic usage: Agents can believe webhook monitoring is active even though events cannot be delivered.

Evidence summary: A reserved `.invalid` callback URL was accepted and marked active; docs document `MH_050 Webhook URL unreachable`.

Proposed fix: Validate reachability or mark endpoints pending until health checks pass.

### MH-API-010: Duplicate webhook registrations for the same URL and events create multiple active endpoints

Severity: Medium

Full report: [findings/MH-API-010-duplicate-webhook-registrations-for-same-url-events.md](findings/MH-API-010-duplicate-webhook-registrations-for-same-url-events.md)

Affected flow: `POST /webhooks`, event delivery, webhook quotas.

Impact on agentic usage: Duplicate event delivery can trigger duplicate agent actions, notifications, or recovery attempts.

Evidence summary: Two calls with the same URL/events and different idempotency keys created active endpoints `290` and `291`.

Proposed fix: Enforce uniqueness by integration, normalized URL, and normalized event set, or document duplicate endpoint semantics.

## Documentation / OpenAPI Blockers

Each documentation blocker has a full report in `findings/` with reproduction steps, evidence, impact, and proposed wording/fix.

| ID | Severity | Title |
| --- | --- | --- |
| `MH-DOC-002` | High / Documentation blocker | Agentic examples default agents to production/mainnet |
| `MH-DOC-009` | Documentation blocker | OpenAPI omits required `Idempotency-Key` on mutating POSTs |
| `MH-DOC-001` | Documentation blocker | Quickstart omits required idempotency headers and hides intermediate confirm call |
| `MH-DOC-013` | Documentation blocker | Webhook delete requires idempotency but docs/OpenAPI omit it |
| `MH-DOC-010` | Documentation blocker | Webhook signature example hashes parsed body and can throw |
| `MH-DOC-011` | Documentation blocker | Estimate docs omit SOL budgeting and conflict on screening fee |
| `MH-DOC-012` | Documentation blocker | OpenAPI does not model documented Bearer auth |
| `MH-DOC-004` | Documentation blocker | Create transfer status inconsistent as `quote` and `awaiting_signature` |
| `MH-DOC-005` | Documentation blocker | PreparedTxBundle nullability inconsistent for resumed arrays |
| `MH-DOC-008` | Documentation blocker | `funding` and `partially_deployed` phases omitted |
| `MH-DOC-007` | Documentation blocker | Webhook create docs omit idempotency and stale event list |
| `MH-DOC-003` | Documentation blocker | Agent context omits reclaim-rent recovery tools |
| `MH-DOC-006` | Documentation blocker | `externalId` duplicate behavior underdocumented |
| `MH-DOC-014` | Documentation blocker | OpenAPI listWebhooks includes secret field omitted by docs/live API |

## Evidence Commands

Sanitized command set used for reproduction:

```bash
npm run docs:fetch
npm run docs:check
npm run audit:env
npm run audit:dry-run
npm run audit:api:smoke
npm run audit:create-probe
npm run audit:prepare-probe
npm run audit:get-transfer
npm run audit:api-behavior
npm run audit:live-devnet
npm audit --omit=dev
solana balance --url https://api.devnet.solana.com
```

Additional direct probes:

- `curl POST /transfers/908/rescue/prepare`
- `curl POST /transfers/910/prepare` after `expiresAt`
- `curl GET /usage` using Bearer auth
- `curl POST /webhooks` with HTTP URL
- `curl POST /webhooks` with unreachable `.invalid` URL
- `curl DELETE /webhooks/{endpointId}` with and without `Idempotency-Key`
- Node probes for duplicate webhook registration and webhook secret/list shape

## Verification Status

Latest verification:

```text
npm run typecheck: pass
npm run docs:check: pass
npm run audit:dry-run: pass
npm run audit:api:smoke: pass
npm audit --omit=dev: pass
GET /webhooks: { "items": [] }
Solana devnet balance: 1.853133417 SOL
Secret scan: no committed API key, key hash, or webhook signing secret found
```

## Responsible Testing Notes

- All testing was against the approved devnet API and devnet Solana RPC.
- No mainnet endpoint or live user funds were used.
- Webhook endpoints created during probes were deleted immediately.
- API keys, key hashes, private keys, bearer tokens, seed phrases, and webhook signing secrets are redacted.
- Transaction signatures are only from approved devnet tests.
