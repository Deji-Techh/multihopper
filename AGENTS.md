# MultiHopper Audit Workspace

Scope for this folder:

- Work only inside `/home/DejiTech/multihopper` unless the user explicitly says otherwise.
- Do not touch FundTracer or any sibling project. Ignore unrelated parent git changes.
- Do not write API keys, private keys, seed phrases, bearer tokens, or wallet secrets to files.
- Use only the approved MultiHopper test environment for bounty testing.
- Default API base URL is `https://devnet.multihopper.com/api/v1`.
- Default Solana RPC is `https://api.devnet.solana.com`.
- Refuse mainnet, production base URLs, or live funds in scripts unless the user gives explicit written approval and the bounty scope allows it.

Audit objective:

- Test the documented MultiHopper agentic transfer flow:
  `create -> prepare -> sign/broadcast -> confirm-broadcast -> monitor`.
- Prioritize signing correctness, partial signature preservation, broadcast ordering, idempotency, retry/resume behavior, expiry handling, status monitoring, webhooks, and documentation blockers.
- Produce reproducible findings with sanitized evidence and practical fixes.

Evidence rules:

- Redact `mh_test_...`, `mh_live_...`, bearer tokens, private keys, seed phrases, and webhook signing secrets.
- Transaction signatures are acceptable evidence if they are from approved devnet tests.
- Keep private logs or screenshots in `reports/private/`; do not commit secrets.

Useful commands:

- `npm run docs:check` - scan local fetched docs for candidate documentation blockers.
- `npm run audit:env` - verify the current environment is bounty-safe.
- `npm run audit:dry-run` - run offline signing/order/safety checks without calling MultiHopper.
- `npm run audit:api:smoke` - authenticated read-only API smoke check against devnet.
