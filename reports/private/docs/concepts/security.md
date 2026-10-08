> ## Documentation Index
> Fetch the complete documentation index at: https://dev-docs.multihopper.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Security Model

> Trust assumptions, threat model, and on-chain enforcement guarantees

## Design Philosophy

MultiHopper is designed to minimize trust. Every constraint that matters for fund safety is enforced by the smart contract — not by an API server, a keeper, or a UI.

The guiding principle: **off-chain components provide convenience; on-chain programs provide guarantees.**

## What the Protocol Guarantees

| Guarantee                                            | Mechanism                                                        |
| ---------------------------------------------------- | ---------------------------------------------------------------- |
| Tokens cannot be redirected to unintended recipients | Route recipients are immutable after creation; enforced on-chain |
| Hops cannot execute before their scheduled time      | On-chain clock validation in `execute_hop` instruction           |
| Hops cannot skip or execute out of order             | Sequential state machine enforced in program logic               |
| Original tokens cannot be withdrawn mid-route        | Vault can only be emptied via `unwrap` after all hops complete   |
| 1:1 wrapper/original backing at all times            | Mint/burn logic enforced by the program                          |
| Only authorized executors can trigger hops           | Access control checks in instruction handlers                    |

## Trust Assumptions

### What you must trust

* **The MultiHopper Core program** — all protocol logic lives here. The program is the root of trust.
* **The Solana runtime** — transaction execution and clock accuracy.
* **The Token2022 runtime** — permanent delegate and transfer hook invocation.

### What you do not need to trust

* **The API server** — it builds transactions but cannot execute them without your signature.
* **The keeper/scheduler** — it can trigger hops but cannot redirect funds. If it misbehaves, it simply fails to execute on time; it cannot steal or misroute.
* **The indexer** — read-only; it has no authority over any on-chain state.
* **The MultiHopper team** — funds are secured by program logic, not by operator keys.

## Threat Model

<AccordionGroup>
  <Accordion title="Route tracing / analysis" icon="magnifying-glass">
    MultiHopper's multi-hop routing increases the abstraction between sender and final recipient, which can make naive on-chain analysis more complex. However, all transfers are publicly visible on Solana and auditable.
  </Accordion>

  <Accordion title="Execution censorship" icon="ban">
    If the MultiHopper scheduler is censored or goes offline, anyone can execute pending hops directly. The protocol cannot be censored at the smart contract level.
  </Accordion>

  <Accordion title="Keeper failures" icon="circle-xmark">
    A keeper failure delays execution but does not result in fund loss. Hops stay pending indefinitely and can be triggered by any executor.
  </Accordion>

  <Accordion title="Smart contract risk" icon="bug">
    As with any on-chain protocol, bugs in the program logic are a risk. The program should be audited before significant value is routed through it. Audit reports will be linked here as they are completed.
  </Accordion>

  <Accordion title="Permanent delegate misuse" icon="key">
    The permanent delegate is scoped to wrapper mints created by the MultiHopper program. It cannot be used to access original tokens in the vault or any other user tokens.
  </Accordion>
</AccordionGroup>

## Audit Status

<Warning>
  MultiHopper is in active development. Smart contract audits are planned prior to mainnet launch with significant TVL. Do not route funds exceeding your risk tolerance until audits are published.
</Warning>

Audit reports will be published here when available.

## Responsible Disclosure

If you discover a security vulnerability in the MultiHopper protocol or infrastructure, please report it to **[security@multihopper.com](mailto:security@multihopper.com)**.

Do not disclose vulnerabilities publicly before coordinating with the team.
