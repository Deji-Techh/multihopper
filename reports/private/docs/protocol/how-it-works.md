> ## Documentation Index
> Fetch the complete documentation index at: https://dev-docs.multihopper.com/llms.txt
> Use this file to discover all available pages before exploring further.

# How It Works

> The core mechanism behind MultiHopper's programmable token routing

## Overview

MultiHopper enables scheduled, sequenced token transfers on Solana. The key insight is separating **custody** from **routing**: original tokens stay locked in a program-controlled vault while wrapper tokens flow through the route.

Three on-chain programs implement the protocol:

* **MultiHopper Core** (`3jLoS2wbNgtKzieUUxwg6Xhdv6gbZkHDtPWA9ZAgspFh`) — handles route creation, hop execution, wrap/unwrap operations, provider registration, and fee management.
* **Orchestrator** (`4TPCmR2uN3hDM1FbTsf7ZtFXwXGSz4u1Kxv5YHj6eruX`) — a permissionless execution engine that coordinates the deployment transaction sequence for a route through discrete, keeper-executable steps.
* **Transfer Hook Guard** (`2JEv3pD6nczEvn1xDXaEzehkJofPPjoQQpnW5nGY3r52`) — implements the Token2022 transfer hook extension, enforcing custom compliance rules on every wrapper token movement.

## Core Mechanism: Wrapper Tokens

MultiHopper uses Solana's [Token2022](https://spl.solana.com/token-2022) extensions to create route-specific wrapper tokens.

<Steps>
  <Step title="Deposit into vault">
    A user deposits original tokens (SOL or SPL) into an on-chain vault controlled by the protocol program.
  </Step>

  <Step title="Mint wrapper tokens">
    The protocol mints an equivalent amount of wrapper tokens using a Token2022 mint with the **permanent delegate** extension enabled. Wrapper tokens are backed 1:1 by the vault.
  </Step>

  <Step title="Execute hops">
    The permanent delegate allows the protocol to programmatically transfer wrapper tokens between hop recipients at scheduled times — without requiring recipient signatures at each step.
  </Step>

  <Step title="Redeem">
    After the route completes, the final recipient burns their wrapper tokens to redeem the original tokens from the vault.
  </Step>
</Steps>

<Note>
  Original tokens never leave the vault until final redemption. The wrapper token mechanism ensures 1:1 backing throughout the entire route lifecycle.
</Note>

## Token2022 Extensions Used

MultiHopper relies on three Token2022 extensions to implement its routing logic:

| Extension              | Role                                                                                                                          |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Permanent Delegate** | Enables programmatic token transfers without holder signatures — the protocol can move wrapper tokens on behalf of recipients |
| **Metadata Pointer**   | Attaches route metadata (hop sequence, timing, recipients) directly to the wrapper mint on-chain                              |
| **Transfer Hook**      | Enforces custom transfer compliance rules at the protocol level on every wrapper token movement                               |

## Orchestrator: Step-Based Deployment

The **Orchestrator program** coordinates the multi-transaction sequence required to deploy a route. Instead of requiring the user to sign every setup transaction themselves, the orchestrator breaks deployment into discrete **steps** that permissionless keepers can execute.

Each step has a type:

| Step Type    | Description                                                        |
| ------------ | ------------------------------------------------------------------ |
| `transfer`   | Transfer SOL or lamports between accounts (e.g. fund a hop wallet) |
| `wrap_sol`   | Wrap SOL into the route's vault via `wrap_sol` on the Core program |
| `wrap_token` | Wrap an SPL token into the route's vault                           |

When a route is deployed through the orchestrator:

1. An `OrchestratorConfig` account is created with the full step sequence and a `keeper_share_bps` incentive.
2. Individual `OrchestratorStep` accounts are initialized, each with an `execute_at` timestamp.
3. Any keeper can execute each step once its scheduled time arrives — earning a share of the deposited funds.
4. After all steps complete, the orchestrator is closed and rent reclaimed.

## On-Chain Enforcement

Every constraint in a route is enforced by the smart contract — there is no trusted off-chain component with authority over funds.

<AccordionGroup>
  <Accordion title="Timelocks" icon="clock">
    Each hop and orchestrator step has an `execute_at` timestamp validated against the Solana clock. A hop or step cannot execute before its scheduled time — the transaction will fail at the contract level.
  </Accordion>

  <Accordion title="Sequencing" icon="list-ol">
    Hops execute in strict order. Hop `N` must complete before hop `N+1` can be triggered. This is enforced by on-chain state tracking within the route account.
  </Accordion>

  <Accordion title="Prepaid hop limit" icon="receipt">
    The `prepaid_hops` field on each route enforces how many hops have been fee-paid. The program rejects execution beyond the prepaid limit.
  </Accordion>

  <Accordion title="Fee collection" icon="coins">
    Protocol fees are collected upfront at route creation. Provider integrators can attach a `provider_id` and optional `reference_id` to routes, with per-provider fee schedules managed via the `FeeSchedule` account.
  </Accordion>
</AccordionGroup>

## Token Support

The wrapper mechanism normalizes all Solana token types into a consistent routing interface:

* Native **SOL** (via dedicated `initialize_route_sol` / `wrap_sol` / `unwrap_sol` instructions)
* Standard **SPL tokens**
* **Token2022** tokens

SOL routes use a dedicated `sol_vault` PDA rather than a token account, with `mint_wsol_tickets` used to issue wrapper tokens representing locked SOL.

## What Happens If a Keeper Fails?

If a keeper fails to execute a step or hop at the scheduled time, the step stays pending and any other executor can trigger it. The protocol does not rely on a single keeper — execution is permissionless.

If a step fails on-chain, the `refund_failed_step` instruction on the Orchestrator returns deposited funds to the creator. The `rescue_step` instruction provides an admin escape hatch for stuck steps.

<Card title="Learn about Keepers" icon="person-running" href="/concepts/keepers">
  Understand how the keeper network provides permissionless, decentralized execution.
</Card>
