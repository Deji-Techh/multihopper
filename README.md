# MultiHopper Agentic Flow Audit

Private audit workspace for the Superteam Earn bounty:

`Break It Before Users Do: MultiHopper Agentic Flow Bugs & Fixes`

This repository contains a devnet-only TypeScript audit harness, fetched documentation references, and sanitized finding reports for MultiHopper's documented agentic transfer flow:

`create -> prepare -> sign/broadcast -> confirm-broadcast -> monitor`

## Safety Scope

- API base URL: `https://devnet.multihopper.com/api/v1`
- Solana RPC: `https://api.devnet.solana.com`
- Test wallet used for evidence: `GrbnzU4RZmMC8AfYBJDx7s2WkARxpJev5t8SCn5WUKjw`
- No private keys, seed phrases, API keys, bearer tokens, or webhook signing secrets are committed.
- Live broadcasting is guarded and disabled unless explicit devnet-only environment flags are set.
- Mainnet and production URLs are rejected by the harness safety checks.

## Setup

```bash
npm ci
cp .env.example .env
```

Add the approved MultiHopper test API key to your shell environment when running authenticated probes. Do not commit `.env`.

```bash
export MULTIHOPPER_API_KEY="mh_test_..."
```

## Verification

```bash
npm run typecheck
npm run docs:check
npm run audit:env
npm run audit:dry-run
npm run audit:api:smoke
npm audit --omit=dev
```

## Main Evidence Files

- [SUBMISSION.md](SUBMISSION.md) - copy/paste submission packet for Superteam Earn.
- [findings/submission-pack.md](findings/submission-pack.md) - recommended issue ordering and command evidence list.
- [findings/](findings/) - one Markdown report per finding.
- [docs/multihopper-docs-reference.md](docs/multihopper-docs-reference.md) - local reference summary from official docs.
- [AGENTS.md](AGENTS.md) - audit workspace rules and safety constraints.

## Finding Count

Current submission packet includes:

- 11 API/runtime findings.
- 14 documentation or OpenAPI contract blockers.

The highest-value findings to review first are:

1. `MH-API-001` - transfer advances to processing without signed broadcasts or confirm-broadcast.
2. `MH-API-005` - idempotency cache replays responses across different actions for the same transfer.
3. `MH-API-011` - expired transfer still returns fresh prepare transaction bundles.
4. `MH-API-008` - authenticated endpoints can leak raw SQL and key hash on auth lookup failure.
5. `MH-API-002` - missing create idempotency returns 500 and SQL details.

## Evidence Hygiene

Before sharing or submitting:

```bash
rg -n -uu 'mh_test_|mh_live_|Authorization: Bearer|seed phrase|private key|whsec_|key_hash|secret": "[a-f0-9]{64}' .
```

Expected result: no committed API key, bearer token, seed phrase, private key, webhook signing secret, or unredacted key hash.
