# Bounty Brief

Source: Superteam Earn listing, "Break It Before Users Do: MultiHopper Agentic Flow Bugs & Fixes" by MultiHopper.

Prize pool: 1,000 USDC, four prizes of 250 USDC.

Scope:

- MultiHopper API usage in automated or agentic workflows.
- Use only the approved test environment, test API keys, wallets, and balances.
- No mainnet testing, live user funds, draining, spam, disruption, or public disclosure before review.

Mission:

- Review the MultiHopper API documentation and agentic integration guide.
- Build or configure an automated workflow or agent that attempts the documented transfer flow.
- Test realistic execution paths and failure cases.
- Submit each valid issue with evidence, reproduction steps, impact, and a proposed fix.

High-value test areas:

- Agent understanding of create, prepare, sign/broadcast, confirm-broadcast, monitor.
- Client-side signing of prepared transaction bundles.
- Preservation of server partial signatures.
- Strict broadcast order:
  `keeperFundingTx -> routeInitTxs -> orchestratorInitTx -> sessionInitTxs`.
- Two-step `confirm-broadcast`, especially immediate keeper funding confirmation.
- Missing keeper funding signatures.
- Idempotency-Key behavior, duplicate submissions, conflicting retries.
- Blockhash expiry, retry, resume, and partially completed broadcasts.
- Status polling, webhook monitoring, recovery paths, and agent interpretation of failures.
- Documentation gaps that materially block safe agent integration.

Submission format:

- Finding title and severity: Critical, High, Medium, Low, or Documentation blocker.
- What was built or used: framework, language, repository/private code link, environment.
- Steps to reproduce and affected API action or flow.
- Evidence: sanitized logs, screenshots, devnet transaction signatures, and/or short demo video.
- Impact on agentic usage or route reliability.
- Proposed fix, mitigation, or improved documentation wording.
- Contact handle.
