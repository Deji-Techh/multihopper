# MH-DOC-002: Agentic autonomous examples default to production/mainnet instead of devnet

Severity: High / Documentation blocker

## Summary

The Agentic Integration guide contains copy-paste autonomous-agent examples that default to `https://multihopper.com`, which is the production/mainnet API host. The same docs say new integrations should start on devnet, and the bounty explicitly restricts testing to the approved test environment. In an agentic workflow, a production default is a safety issue because an automated process can execute the example without a human noticing the cluster mismatch.

## What I Built Or Used

- TypeScript audit harness in `/home/DejiTech/multihopper`.
- Official docs snapshot fetched from `https://dev-docs.multihopper.com`.
- Reproduction commands: `npm run docs:fetch`, then `npm run docs:check`.
- Offline safety gate in `src/config.ts` rejects production API base URL and mainnet RPC by default.

## Affected Flow

- Full autonomous TypeScript loop in the Agentic Integration guide.
- Agent context block intended for `CLAUDE.md` or system prompts.
- Any agent that copies the documented base URL and runs transfer creation/preparation automatically.

## Steps To Reproduce

1. Open `https://dev-docs.multihopper.com/guides/agentic-integration`.
2. Go to "Full autonomous loop (TypeScript)".
3. Observe the API base constant.
4. Go to "Agent context file (CLAUDE.md)".
5. Observe the REST API URL in the agent prompt block.
6. Compare with the Environments page.

## Evidence

Local docs snapshot line references:

- `reports/private/docs/guides/agentic-integration.md:367` sets `const API_BASE = "https://multihopper.com";`.
- `reports/private/docs/guides/agentic-integration.md:384`, `394`, and `409` use that base URL for mutating transfer calls.
- `reports/private/docs/guides/agentic-integration.md:445` tells agents `REST API: https://multihopper.com/api/v1`.
- `reports/private/docs/concepts/environments.md:15` shows devnet and production base URLs.
- `reports/private/docs/concepts/environments.md:18-19` says production uses mainnet-beta and real assets.
- `reports/private/docs/concepts/environments.md:30-31` says to start on devnet while building and testing.

Docs checker output:

```text
MH-DOC-002: Agentic autonomous TypeScript loop defaults to production host
Evidence:
- Agentic guide contains: const API_BASE = "https://multihopper.com";

MH-DOC-002B: Agent context block defaults agents to production REST API
Evidence:
- Agent context file contains production REST API URL.
```

Offline safety harness output:

```text
PASS safety gate rejects production API and mainnet RPC
PASS safety gate accepts devnet HTTP checks
```

## Expected Result

Agentic examples should default to devnet/test infrastructure:

```typescript
const API_BASE = "https://devnet.multihopper.com/api/v1";
```

Production/mainnet should require an explicit operator change after the integration has been tested.

## Actual Result

The autonomous loop and agent context default to production URLs. The example then calls transfer creation and preparation endpoints using that base URL.

## Impact

This is a practical agent-safety issue:

- Agents can execute examples automatically.
- The production environment maps to mainnet-beta and real assets.
- `mh_test_` is not enough to imply devnet because docs state keys are bound to the environment that minted them.
- A copy-paste agent can accidentally prepare or submit production/mainnet transfer flow calls when the developer intended devnet.

## Proposed Fix

Change default agentic examples to devnet and make production explicit:

```typescript
const API_BASE = process.env.MULTIHOPPER_BASE_URL ?? "https://devnet.multihopper.com/api/v1";

if (API_BASE.includes("multihopper.com/api/v1") && !process.env.ALLOW_MULTIHOPPER_PRODUCTION) {
  throw new Error("Refusing production MultiHopper API by default. Set ALLOW_MULTIHOPPER_PRODUCTION=true only after approval.");
}
```

Update the agent context block:

```markdown
REST API: https://devnet.multihopper.com/api/v1 by default for testing.
Production: https://multihopper.com/api/v1 only after explicit approval.
```

## Contact

TBD
