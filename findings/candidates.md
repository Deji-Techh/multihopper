# Candidate Findings

These are working notes, not final submissions. Confirm each candidate with script output, API evidence, or docs screenshots before submitting.

## MH-API-001: Transfer advances to `processing` without signed broadcasts or `confirm-broadcast`

Severity: High

Affected flow:

- Create -> prepare -> monitor.
- Status polling and agent resume logic.

Observed:

- Transfer `898` was created on devnet with test key.
- First `/prepare` returned `transfer.status: "awaiting_signature"` and a full bundle.
- No signing, broadcasting, or `confirm-broadcast` call was made.
- `GET /transfers/898` later returned `status: "processing"`, `phase: "deploying"`, and empty signature arrays.
- A second `/prepare` still returned a full undeployed bundle with `routeAlreadyDeployed: false`, `orchestratorAlreadyInitialized: false`, `keeperAlreadyFunded: false`, and `nothingToDo: false`.
- Transfer `910` later showed the same empty-signature `processing/deploying` pattern more than three hours after `expiresAt`.

Why it matters:

- Agents may think the keeper has taken over and stop broadcasting.
- Status monitoring can show a route as deploying when no on-chain deployment has started.
- Resume logic receives contradictory signals from `status/phase` and `preparedTxs.resume`.

Proposed fix:

- Gate `processing` on final `confirm-broadcast` plus verified on-chain state/signatures.
- Keep prepare-only transfers in `awaiting_signature` or another clear pre-broadcast phase.

Evidence collected:

- `findings/MH-API-001-prepare-advances-transfer-to-processing-without-confirm-broadcast.md`
- `npm run audit:create-probe`
- `npm run audit:prepare-probe`
- `npm run audit:get-transfer`

## MH-API-002: `POST /transfers` without `Idempotency-Key` returns 500 and leaks internal SQL

Severity: Medium

Affected flow:

- `POST /transfers`
- Idempotency validation.
- Error handling.

Observed:

- Missing `Idempotency-Key` on create returned HTTP 500.
- Response body included raw SQL against `api_keys` and `integrations`.
- Response included internal column names and a key-hash parameter value, redacted in the report.
- Missing idempotency on `/prepare` and `/confirm-broadcast` correctly returned `400 MH_070`, so create behaves differently.

Why it matters:

- Agents cannot classify the missing-header error as `MH_070`.
- The Quickstart currently omits this header, so this is easy to trigger.
- Internal database/query details should not be returned to clients.

Proposed fix:

- Validate `Idempotency-Key` on create before create logic.
- Return `400 MH_070`.
- Add a global error sanitizer for DB exceptions.

Evidence collected:

- `findings/MH-API-002-create-without-idempotency-returns-500-sql-leak.md`
- `npm run audit:api-behavior`

## MH-API-003: Live flow returns undocumented `active` status and misleading progress/signature fields

Severity: Medium

Affected flow:

- Full create -> prepare -> sign/broadcast -> confirm-broadcast -> monitor flow.
- `GET /transfers/{id}` status and progress contract.

Observed:

- Transfer `908` completed all client-side initialization broadcasts on devnet.
- All five client-broadcast signatures were finalized on Solana devnet.
- Final `confirm-broadcast` returned `status: "active"`, which is not in docs or OpenAPI.
- `GET /transfers?status=active` returned transfer `908`, even though the OpenAPI list status filter enum omits `active`.
- `GET /transfers/908` returned `status: "active"`, `phase: "executing"`, `progress.hopsTotal: 5`, and `hopsCompleted: 0`.
- The transfer was created with `hops: 3`, while `/prepare` resume said `totalHops: 3` and `totalSteps: 5`.
- `GET /transfers/908` exposed only one route init signature and no session signatures, despite confirmed route/session init txs.

Why it matters:

- Strict generated clients can reject undocumented `active`.
- Agents do not know whether `active` is equivalent to `processing`.
- Progress and signatures are misleading for monitoring and evidence.

Proposed fix:

- Add `active` to the public enum/docs or map it to documented `processing`.
- Clarify `hopsTotal` vs total steps.
- Expose all recorded client-broadcast signatures or document the signature object as partial.

Evidence collected:

- `findings/MH-API-003-live-flow-returns-undocumented-active-status-and-misleading-progress.md`
- `npm run audit:live-devnet`
- `solana confirm ... --url https://api.devnet.solana.com`
- `npm run audit:prepare-probe`

## MH-API-004: Expired/stuck transfer remains `active/executing` while rescue is already actionable

Severity: Medium

Affected flow:

- Status monitoring after expiry.
- Rescue/recovery decision logic.

Observed:

- Transfer `908` had `expiresAt: 2026-07-05T19:46:12.023Z`.
- A later `GET /transfers/908` at about `2026-07-05T23:25Z` still returned `status: "active"` and `phase: "executing"`.
- `progress.hopsCompleted` remained `0` and `lastError` was still `null`.
- The same response returned `recovery.canRescue: true` and `recovery.rescuableLamports: 111316960`.
- `POST /transfers/908/rescue/prepare` returned HTTP 200 with one rescue transaction.
- Human docs say `recovery` is only populated when `phase` is `recoverable`, `settled`, `rescued`, or `reclaimed`, but the API returned recovery while phase was `executing`.

Why it matters:

- Agents receive contradictory next actions: keep monitoring an active/executing route or start rescue.
- Funds can remain locked until an operator notices the recovery hint.
- Automated recovery policy cannot rely on documented status/phase transitions.

Proposed fix:

- Transition stuck/expired transfers with available rescue into a documented recovery state.
- Populate `lastError` with a structured reason.
- Align docs and implementation if recovery can intentionally appear during `executing`.

Evidence collected:

- `findings/MH-API-004-expired-transfer-remains-active-while-rescue-is-actionable.md`
- `npm run audit:get-transfer`
- Direct safe `POST /transfers/908/rescue/prepare` check with no signing or broadcast.

## MH-API-005: Idempotency cache replays responses across different actions for the same transfer

Severity: High

Affected flow:

- `POST /transfers/{id}/prepare`
- `POST /transfers/{id}/rescue/prepare`
- Agent retry/idempotency handling.

Observed:

- `POST /transfers/908/prepare` with key `cross-scope-prepare-first-20260705` returned a normal `{ transfer, preparedTxs }` response.
- Reusing the same key on `POST /transfers/908/rescue/prepare` returned the cached `{ transfer, preparedTxs }` response instead of a rescue bundle.
- In reverse order, `POST /transfers/908/rescue/prepare` returned `{ rescueTxs, recentBlockhash, lastValidBlockHeight, rescuable }`.
- Reusing that key on `POST /transfers/908/prepare` returned the cached rescue response instead of `{ transfer, preparedTxs }`.
- Reusing a key across different transfer IDs returned `409 MH_071`, so the replay appears tied to same-transfer, different-action requests.

Why it matters:

- Agents can receive and possibly sign the wrong transaction bundle type.
- Recovery tools can return deployment data, while deployment tools can return rescue data.
- Generated clients receive a response schema that does not match the requested operation.

Proposed fix:

- Include method, canonical route/action, transfer ID, and normalized body in the idempotency fingerprint.
- Reject same-key reuse across different actions with `409 MH_071`.

Evidence collected:

- `findings/MH-API-005-idempotency-key-replays-responses-across-different-actions.md`
- Direct safe devnet API checks with no signing or broadcast.

## MH-API-006: Validation and webhook errors use generic or wrong-domain codes

Severity: Medium

Affected flow:

- `POST /transfers`
- `POST /transfers/estimate`
- `POST /webhooks`
- `DELETE /webhooks/{endpointId}`
- Agent validation/error handling.

Observed:

- Docs say all errors include structured `MH_XXX` codes.
- Docs list `MH_011`, `MH_012`, and `MH_013` for invalid wallet, low amount, and hops out of range.
- Invalid `hops: 2` on estimate returned `400 BAD_REQUEST`.
- Invalid `tokenMint: "bad"` on estimate returned `400 BAD_REQUEST`.
- Invalid `hops: 2` on create returned `400 BAD_REQUEST`.
- Invalid `sourceOwner: "bad"` on create returned `400 BAD_REQUEST`.
- Tiny amount on create returned `MH_016`, which is not documented in the error-code table.
- Malformed JSON on `POST /webhooks` returned framework code `FST_ERR_CTP_INVALID_JSON_BODY` outside the standard error envelope.
- Wrong content type on `POST /webhooks` returned `400 BAD_REQUEST`.
- Invalid webhook endpoint IDs returned `400 BAD_REQUEST`.
- Missing webhook endpoint deletion returned `MH_030` with `Transfer not found — Webhook endpoint not found`.

Why it matters:

- Agents cannot classify common validation failures by stable documented code.
- Integrations may parse human-readable error strings.
- Webhook cleanup automation may classify a missing webhook as a missing transfer.

Proposed fix:

- Map schema validation to documented `MH_XXX` codes.
- Document `MH_016` if intentional.
- Normalize malformed JSON/content-type errors into the public structured error shape.
- Add webhook-specific codes for invalid or missing webhook endpoints.

Evidence collected:

- `findings/MH-API-006-validation-errors-use-bad-request-and-undocumented-codes.md`
- Direct safe devnet API validation probes.

## MH-DOC-001: Quickstart copy-paste flow omits required Idempotency-Key headers and hides the intermediate confirm call

Severity: Documentation blocker

Affected docs:

- `quickstart.md`, Step 2 create transfer cURL.
- `quickstart.md`, Step 3 prepare transactions cURL.
- `quickstart.md`, Step 4 confirm broadcast cURL.

Observed:

- API Introduction says all POST mutations require `Idempotency-Key`.
- Transfer API reference examples include `Idempotency-Key`.
- Quickstart cURL examples for create, prepare, and confirm omit the header.
- Quickstart overview correctly mentions the intermediate keeper-funding confirm, but the detailed Step 4 only shows a final all-signatures confirm example.

Why it matters:

- Agents tend to follow the nearest copy-paste block.
- Missing idempotency can produce `MH_070`.
- Skipping the immediate keeper-funding confirm weakens the documented protection against double funding on resume.

Proposed fix:

- Add `-H "Idempotency-Key: $(uuidgen)"` to every Quickstart mutating POST example.
- Split Step 4 into "Confirm keeper funding immediately" and "Final confirm after remaining txs".

Evidence to collect:

- `npm run docs:check` output.
- Screenshot or exported markdown of Quickstart blocks.

## MH-DOC-002: Agentic guide autonomous examples default to production/mainnet URL

Severity: High or Documentation blocker

Affected docs:

- Agentic Integration, full autonomous TypeScript loop.
- Agent context block.

Observed:

- The TypeScript autonomous loop declares `const API_BASE = "https://multihopper.com";`.
- The agent context block says `REST API: https://multihopper.com/api/v1`.
- Environment docs say new integrations should start on devnet, and the bounty requires approved test environment only.

Why it matters:

- A copy-paste autonomous agent can target production/mainnet by default.
- Production can use real assets and mainnet-beta.
- This is a safety issue for agentic workflows because agents may run examples automatically.

Proposed fix:

- Default autonomous examples and context blocks to `https://devnet.multihopper.com/api/v1`.
- Make production an explicit override.
- Include a guard that rejects mainnet unless the operator intentionally sets an environment variable after approval.

Evidence to collect:

- `npm run docs:check` output.
- Screenshot or exported markdown of Agentic Integration examples.

## MH-DOC-003: Recovery docs mention rescue but omit reclaim-rent tools from the agent context

Severity: Low or Documentation blocker, pending validation.

Affected docs:

- OpenAPI exposes `reclaim-rent` prepare/confirm endpoints.
- Agentic guide context lists rescue tools but not reclaim-rent tools.

Observed:

- `GET /transfers/{id}` documents `recovery.canReclaimRent`.
- OpenAPI exposes `POST /transfers/{id}/reclaim-rent/prepare` and `/confirm`.
- The agent tool table includes `prepare_rescue` and `confirm_rescue` only.

Why it matters:

- Agents may stop after settlement and fail to reclaim rent even when `canReclaimRent` is true.

Proposed fix:

- Add `prepare_reclaim_rent` and `confirm_reclaim_rent` to the agent context/tool table.
- Include trigger condition: when `recovery.canReclaimRent === true`.

Evidence to collect:

- `npm run docs:check` output.
- OpenAPI path list.

## MH-DOC-004: Create transfer initial status is documented as both `quote` and `awaiting_signature`

Severity: Documentation blocker

Affected docs:

- Create Transfer API reference.
- Quickstart.
- Agentic Integration agent context block.

Observed:

- Create API reference and OpenAPI say a new transfer is in `quote` status.
- Quickstart says the create response has status `awaiting_signature`.
- Agent context says create returns `{ id, status: "awaiting_signature", ... }`.
- A create-only devnet probe returned `status: "quote"` for transfer `898`.
- A prepare-only devnet probe for transfer `898` returned `transfer.status: "awaiting_signature"`.

Why it matters:

- Agents may wait for `awaiting_signature` before calling `/prepare` and stall, even though `/prepare` is the step that moves the transfer there.

Proposed fix:

- Document the actual transition: create returns `quote`; prepare returns or moves the transfer to `awaiting_signature`.

Evidence collected:

- `findings/MH-DOC-004-create-status-inconsistent.md`
- `npm run audit:create-probe` output from devnet test mode.

## MH-DOC-005: PreparedTxBundle nullability is inconsistent for resumed route/session arrays

Severity: Documentation blocker

Affected docs:

- Prepare API reference.
- Agentic Integration resume section.
- OpenAPI `PreparedTxBundle` schema.

Observed:

- Agentic guide says already-confirmed groups are returned as `null`, and shows `routeInitTxs: null`.
- Prepare API reference describes `routeInitTxs` and `sessionInitTxs` as arrays, empty or omitted when already done.
- OpenAPI marks `keeperFundingTx` and `orchestratorInitTx` nullable, but not `routeInitTxs` or `sessionInitTxs`.

Why it matters:

- Generated clients may not accept `null` for route/session arrays.
- Resume logic can crash at exactly the point where the agent is recovering from partial broadcast or expiry.

Proposed fix:

- Align all docs and schema around `array`, `null`, or `array | null`.

Evidence collected:

- `findings/MH-DOC-005-prepared-bundle-nullability-inconsistent.md`
- `npm run docs:check` output.

## MH-DOC-006: externalId duplicate behavior is underdocumented for same-body vs conflicting-body retries

Severity: Low / Documentation blocker

Affected docs:

- Create Transfer API reference.
- API Introduction error code table.

Observed:

- Same `externalId` and same parameters returns the existing transfer with 200.
- Same `externalId` and different parameters returns `409 MH_033`.
- Docs mention both "returns existing" and duplicate error, but do not clearly explain the difference.

Why it matters:

- Agents need to know whether a duplicate externalId means safe resume or parameter conflict.

Proposed fix:

- Document both branches explicitly and include both response examples.

Evidence collected:

- `findings/MH-DOC-006-external-id-idempotency-conflict-docs.md`
- `npm run audit:api-behavior`

## MH-DOC-007: Webhook create docs omit required idempotency header and stale event types

Severity: Documentation blocker

Affected docs:

- Register Webhook API reference.
- Webhook Events page.
- OpenAPI webhook event enum.

Observed:

- `POST /webhooks` enforces `Idempotency-Key` and returns `400 MH_070` when it is missing.
- The Register Webhook cURL example omits `Idempotency-Key`.
- The Register Webhook event list omits `transfer.phase_changed`, `transfer.recoverable`, `transfer.rescued`, and `transfer.rent_reclaimed`.
- The Webhook Events page and OpenAPI enum include those events.

Why it matters:

- Agents copying the webhook create example fail registration.
- Agents can miss recovery lifecycle events during monitoring.

Proposed fix:

- Add `Idempotency-Key` to the webhook create example.
- Align the event list with OpenAPI and Webhook Events docs.

Evidence collected:

- `findings/MH-DOC-007-webhook-create-docs-missing-idempotency-and-events.md`
- Direct safe devnet API check for missing idempotency.

## MH-DOC-008: `funding` and `partially_deployed` phases omitted from human docs and agent context

Severity: Low / Documentation blocker

Affected docs:

- GET Transfer API reference.
- Agentic Integration agent context.
- OpenAPI phase enum.

Observed:

- OpenAPI includes `funding` and `partially_deployed` in the phase enum.
- Human docs list phases but omit `funding` and `partially_deployed`.
- Agent context lists phases but omits `funding` and `partially_deployed`.
- A safe devnet API check returned `phase: "funding"` after a failed bogus keeper signature confirm.

Why it matters:

- Agents may treat valid API phases as unknown states.

Proposed fix:

- Add `funding` and `partially_deployed` to all human phase lists and explain valid actions.

Evidence collected:

- `findings/MH-DOC-008-phase-funding-omitted-from-human-docs.md`

## MH-DOC-009: OpenAPI omits required Idempotency-Key header on mutating POST operations

Severity: Documentation blocker

Affected docs:

- OpenAPI specification.
- Generated SDKs and MCP tools derived from OpenAPI.

Observed:

- API Introduction says all POST mutations require `Idempotency-Key`.
- Live devnet API returns `400 MH_070` when `POST /transfers/908/prepare` is called without the header.
- The same endpoint returns HTTP 200 when called with a UUID idempotency key.
- OpenAPI contains zero `Idempotency-Key` references.
- Mutating POST operation parameters only include path parameters or no parameters.

Why it matters:

- OpenAPI-generated clients and agent tools will omit a required runtime header.
- Agents fail at create/prepare/confirm/recovery/webhook flows even though their generated code matches the spec.

Proposed fix:

- Add a reusable required `Idempotency-Key` header parameter to every mutating POST operation.
- Document `POST /transfers/estimate` as exempt if it is intentionally read-only.

Evidence collected:

- `findings/MH-DOC-009-openapi-omits-idempotency-key-header.md`
- `npm run docs:check`
- Direct safe devnet API check for `MH_070`.

## MH-DOC-010: Webhook signature verification example hashes parsed req.body and can throw

Severity: Documentation blocker

Affected docs:

- Webhook Events signature verification example.
- Webhook-based monitoring examples for agents.

Observed:

- The example signs/verifies `payload`, then calls `verifyWebhook(req.body, signature, whsec_secret)`.
- In common frameworks, `req.body` is parsed JSON, not the exact raw request body bytes.
- Local Node reproduction shows parsed object input throws `ERR_INVALID_ARG_TYPE`.
- A malformed short signature throws `ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH` because buffer lengths are not checked before `timingSafeEqual`.

Why it matters:

- Webhook handlers copied from the docs may reject valid deliveries or crash on malformed signatures.
- Agents relying on webhooks can lose lifecycle/recovery events.

Proposed fix:

- Document raw-body verification and length checks before `timingSafeEqual`.
- Add framework-specific raw body examples.

Evidence collected:

- `findings/MH-DOC-010-webhook-signature-example-uses-parsed-body-and-can-throw.md`
- Local Node.js crypto reproduction.

## MH-DOC-011: Estimate docs omit SOL budgeting fields and conflict on screening fee

Severity: Documentation blocker

Affected docs:

- Estimate Fees API reference.
- Quickstart Step 1 estimate example.
- OpenAPI estimate response schema.

Observed:

- Human estimate docs only document top-level fee fields.
- Quickstart estimate response only shows four fields.
- OpenAPI includes `tokens` and `sol` sections, but omits live `sol.breakdown.screeningFeeLamports` and `sol.minTransferAmountLamports`.
- Live devnet estimate response includes `tokens`, `sol.requiredSolUpFrontLamports`, `sol.minTransferAmountLamports`, and `sol.breakdown.screeningFeeLamports`.
- Human docs warn that the estimate does not include the compliance screening fee and instruct agents to add it on top.

Why it matters:

- Agents may over-budget by double-counting screening deposit or under-budget by ignoring SOL fields absent from human docs.
- Wallet SOL budgeting affects whether `/prepare` and broadcast can succeed.

Proposed fix:

- Fully document `tokens` and `sol` response fields.
- Clarify whether screening deposit is included per environment.
- Align OpenAPI with live response fields.

Evidence collected:

- `findings/MH-DOC-011-estimate-docs-omit-sol-budgeting-and-conflict-on-screening-fee.md`
- Direct safe devnet `POST /transfers/estimate` check.

## MH-DOC-012: OpenAPI does not model documented Bearer authentication

Severity: Documentation blocker

Affected docs:

- API Introduction.
- OpenAPI `components.securitySchemes`.

Observed:

- Human docs say API keys can be passed via `x-api-key` or `Authorization: Bearer ...`.
- Live devnet `GET /usage` with `Authorization: Bearer <test key>` returned HTTP 200.
- OpenAPI only defines an `apiKey` scheme for `x-api-key`.
- OpenAPI does not define `type: "http", scheme: "bearer"`.

Why it matters:

- OpenAPI-generated clients and agent tools may not expose Bearer auth as a supported method.
- Agents using standard Authorization-header secret injection need custom overrides.

Proposed fix:

- Add `bearerAuth` as an alternate OpenAPI security scheme.

Evidence collected:

- `findings/MH-DOC-012-openapi-does-not-model-bearer-auth.md`
- Direct read-only devnet `GET /usage` Bearer auth check.

## MH-API-007: Webhook registration accepts plaintext HTTP callback URLs

Severity: Medium

Affected API actions:

- `POST /webhooks`

Observed:

- Webhook docs and OpenAPI describe the callback URL as HTTPS.
- Live devnet accepted `http://example.com/webhook`.
- The API returned HTTP 200, marked the webhook active, and returned a signing secret.
- The returned signing secret was raw 64-character hex, while human docs say webhook secrets are prefixed with `whsec_`.
- The test webhook was deleted and `GET /webhooks` returned `{ "items": [] }`.

Why it matters:

- Agents can accidentally register plaintext callback URLs despite the documented HTTPS requirement.
- Transfer lifecycle payloads and webhook signatures may be exposed over HTTP.
- Agents validating the documented `whsec_` prefix may reject actual live secrets.

Proposed fix:

- Enforce HTTPS server-side for webhook callback URLs.
- Return a documented validation code for HTTP URLs.
- Align the secret format in docs and responses.

Evidence collected:

- `findings/MH-API-007-webhook-registration-accepts-http-url.md`
- Direct devnet `POST /webhooks` and cleanup checks.

## MH-API-008: Authenticated endpoints leak raw SQL and key hash on auth lookup failure

Severity: High

Affected API actions:

- `GET /webhooks`
- `GET /usage`
- `GET /transfers?limit=1`
- `x-api-key` authentication
- Bearer authentication

Observed:

- Multiple authenticated read-only endpoints returned HTTP 500.
- The public response body contained a raw SQL query against `api_keys` and `integrations`.
- The public response body included a key hash parameter, redacted in the report.
- The failure reproduced after a retry window and through both supported auth header styles.

Why it matters:

- Internal auth schema and integration metadata fields are exposed.
- Agents cannot perform basic usage checks, transfer listing, or webhook cleanup.
- Error responses do not match the documented structured `MH_XXX` format.

Proposed fix:

- Sanitize auth lookup failures and never return raw database exception messages to clients.
- Redact key hashes and internal identifiers from all public errors.
- Add regression tests for auth lookup failures on read-only endpoints.

Evidence collected:

- `findings/MH-API-008-authenticated-endpoints-leak-sql-on-auth-lookup-failure.md`
- Direct devnet read-only checks across three endpoints and two auth styles.

## MH-API-011: Expired transfer still returns a fresh prepare transaction bundle

Severity: High

Affected API actions:

- `POST /transfers/{transferId}/prepare`
- Expiry and resume behavior.

Observed:

- Transfer `910` expired at `2026-07-05T19:57:17.630Z`.
- More than five hours later, `POST /transfers/910/prepare` returned HTTP 200.
- The response included fresh keeper funding, route init, orchestrator init, and session init transaction bundles.
- Resume flags showed no deployment or keeper funding was complete.
- No transaction was signed or broadcast during this probe.

Why it matters:

- Agents can sign and broadcast stale transfer work after the documented expiry time.
- Expired transfers should become terminal or recovery-only, not generate fresh signable bundles.

Proposed fix:

- Check `expiresAt` before generating prepare bundles and return `MH_034` or a documented recovery response.

Evidence collected:

- `findings/MH-API-011-expired-transfer-prepare-returns-fresh-transaction-bundle.md`
- Direct prepare-only devnet check on transfer `910`.

## MH-API-009: Webhook registration accepts unreachable callback URLs despite documented MH_050

Severity: Medium

Affected API actions:

- `POST /webhooks`

Observed:

- API Introduction documents `MH_050 Webhook URL unreachable`.
- Live devnet accepted `https://nonexistent-mh-1783296474276.invalid/webhook`.
- The API returned HTTP 200, marked the webhook active, and returned a signing secret.
- The test webhook was deleted and `GET /webhooks` returned `{ "items": [] }`.

Why it matters:

- Agents can believe webhook monitoring is configured even though no lifecycle events can be delivered.
- Transfer failure, expiry, rescue, or completion events can be missed.

Proposed fix:

- Validate webhook reachability during registration and return `MH_050`, or mark endpoints pending until a health check succeeds.

Evidence collected:

- `findings/MH-API-009-webhook-registration-accepts-unreachable-url.md`
- Direct devnet `POST /webhooks` with reserved `.invalid` URL and cleanup.

## MH-API-010: Duplicate webhook registrations for the same URL and events create multiple active endpoints

Severity: Medium

Affected API actions:

- `POST /webhooks`
- `GET /webhooks`

Observed:

- Two `POST /webhooks` calls with the same URL and event set but different idempotency keys both returned HTTP 200.
- `GET /webhooks` showed two active endpoint IDs with the same URL/events.
- Both endpoints were deleted and `GET /webhooks` returned `{ "items": [] }`.

Why it matters:

- Duplicate event delivery can trigger duplicate agent actions or notifications.
- Duplicate endpoints consume webhook quota.
- Same receiver may receive equivalent events signed with different secrets.

Proposed fix:

- Enforce uniqueness by integration, normalized URL, and normalized event set, or document duplicate endpoint semantics.

Evidence collected:

- `findings/MH-API-010-duplicate-webhook-registrations-for-same-url-events.md`
- Direct devnet duplicate-create/list/delete probe.

## MH-DOC-013: Webhook delete requires Idempotency-Key but docs and OpenAPI omit it

Severity: Documentation blocker

Affected docs:

- Delete Webhook API reference.
- OpenAPI `deleteWebhook` operation.

Observed:

- `DELETE /webhooks/287` without `Idempotency-Key` returned `400 MH_070`.
- The same delete with a valid idempotency key returned HTTP 200 and `{ "deleted": true }`.
- Human docs and OpenAPI only document the `endpointId` path parameter.

Why it matters:

- Agents generated from docs/OpenAPI fail webhook cleanup.
- Stale webhooks can remain active after failed test or monitoring flows.
- The docs say POST mutations require idempotency, but live DELETE also enforces it.

Proposed fix:

- Add `Idempotency-Key` to the Delete Webhook docs and OpenAPI operation.
- Clarify whether all mutations, not only POST mutations, require idempotency keys.

Evidence collected:

- `findings/MH-DOC-013-webhook-delete-idempotency-omitted.md`
- Direct devnet `DELETE /webhooks/{endpointId}` check with and without idempotency.

## MH-DOC-014: OpenAPI listWebhooks includes a secret field that human docs and live API omit

Severity: Documentation blocker

Affected docs:

- List Webhooks API reference.
- OpenAPI `listWebhooks` response schema.

Observed:

- Human docs list `id`, `url`, `events`, `isActive`, and `createdAt`.
- OpenAPI list item schema includes `secret`.
- Live `GET /webhooks` while an endpoint was active omitted `secret`.

Why it matters:

- Generated agents may expect webhook secrets to be recoverable from list responses.
- Code generated from OpenAPI may log or handle `secret` as normal list state.

Proposed fix:

- Remove `secret` from the list response schema, or document that it is always omitted/null after creation.

Evidence collected:

- `findings/MH-DOC-014-openapi-list-webhooks-includes-secret-field.md`
- Direct devnet create/list/delete secret-shape probe.

## MH-TX-001: TypeScript signing guidance may be internally inconsistent

Severity: Low documentation consistency issue, not a confirmed signing bug.

Affected docs:

- Agentic Integration TypeScript signing helper.
- Agent context signing rules.

Observed:

- The warning says to preserve existing server partial signatures.
- The TypeScript helper uses `VersionedTransaction.sign([keypair])`.
- The later agent context says not to call `sign()` or replace all signatures.

Validation:

- Run `npm run audit:dry-run`.
- Current `@solana/web3.js` preserved the existing server partial signature in the local fixture.
- This is not a high-impact signing bug with the installed version.
- There is still a wording inconsistency: the TypeScript example calls `VersionedTransaction.sign([keypair])`, while the later agent context says "Do NOT call sign()".

Proposed fix:

- Provide a safe TypeScript helper that asserts non-owner signatures remain unchanged after signing.
