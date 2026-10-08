# Audit Plan

## Phase 1: Documentation And Agent Prompt Review

- Compare Quickstart, API Reference, OpenAPI, and Agentic Integration guide.
- Flag contradictions that cause copy-paste agents to omit required headers, use the wrong environment, broadcast in the wrong order, or lose partial signatures.
- Convert each issue into a minimal reproduction using only docs text and script output.

## Phase 2: Offline Harness

- Verify VersionedTransaction signing preserves server partial signatures.
- Verify broadcast ordering and two-step confirm body construction.
- Verify safety gates reject production API base URLs, mainnet RPC, and live broadcast by default.
- Validate redaction of secrets in logs.

## Phase 3: Devnet API Smoke

Only after `MULTIHOPPER_API_KEY` is set in the environment:

- Read-only API calls: usage and transfer list.
- Confirm key/environment pairing.
- Avoid creating transfers until wallet and token funding are confirmed devnet-only.

## Phase 4: Controlled Devnet Transfer Tests

Only with approved devnet wallet and test balances:

- Create transfer with unique external ID.
- Prepare bundle.
- Decode transaction bundle and inspect signer slots before signing.
- Sign while preserving partial signatures.
- Broadcast keeper funding first and confirm immediately.
- Broadcast remaining groups in strict order.
- Final confirm only after on-chain confirmation.
- Poll status to terminal state.

## Phase 5: Failure-Mode Tests

Run one controlled failure at a time:

- Missing `Idempotency-Key`.
- Duplicate idempotency key with same body.
- Duplicate idempotency key with conflicting body.
- Missing keeper funding signature.
- Final confirm before transactions are confirmed.
- Expired blockhash followed by re-prepare.
- Interrupted broadcast after keeper funding.
- Resume after route init only.
- Recovery endpoints when transfer enters recoverable state.

## Phase 6: Report Packaging

For each finding:

- Title and severity.
- Affected docs/API action/flow.
- What was built.
- Reproduction steps.
- Expected vs actual behavior.
- Sanitized evidence.
- Impact on agentic usage or route reliability.
- Practical fix or documentation wording.
