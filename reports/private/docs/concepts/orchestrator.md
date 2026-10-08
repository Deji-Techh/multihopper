> ## Documentation Index
> Fetch the complete documentation index at: https://dev-docs.multihopper.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Orchestrator

> Permissionless step-based execution engine for route deployment

## What is the Orchestrator?

The **Orchestrator** is a separate Solana program (`4TPCmR2uN3hDM1FbTsf7ZtFXwXGSz4u1Kxv5YHj6eruX`) that coordinates the multi-transaction sequence required to deploy a MultiHopper route.

Deploying a route involves multiple on-chain operations: funding intermediate accounts, wrapping tokens into vaults, and initializing route state. The Orchestrator breaks this sequence into discrete **steps** that any keeper can execute permissionlessly — removing the requirement for the route creator to sign and submit every setup transaction themselves.

## OrchestratorConfig

When a route deployment begins, an `OrchestratorConfig` account is created on-chain:

| Field              | Type       | Description                                                                        |
| ------------------ | ---------- | ---------------------------------------------------------------------------------- |
| `orchestrator_id`  | `[u8; 32]` | Unique 32-byte orchestrator identifier                                             |
| `creator`          | `Pubkey`   | Wallet that initiated the orchestrator                                             |
| `keeper_share_bps` | `u16`      | Keeper incentive in basis points — share of step deposits earned per executed step |
| `steps_count`      | `u8`       | Total number of steps in this orchestrator                                         |
| `remaining_steps`  | `u16`      | Steps not yet completed — decrements on each successful execution                  |
| `bump`             | `u8`       | PDA bump seed                                                                      |

The account address is derived as: `PDA: [b"orchestrator", orchestrator_id]`

## Step Types

Each `OrchestratorStep` account has an `execute_at` timestamp and one of three types:

| Step Type    | Instruction               | Description                                                                |
| ------------ | ------------------------- | -------------------------------------------------------------------------- |
| `transfer`   | `execute_step_transfer`   | Transfers SOL lamports between accounts (e.g. fund an intermediate wallet) |
| `wrap_sol`   | `execute_step_wrap_sol`   | Wraps SOL into the route vault via the MultiHopper Core program            |
| `wrap_token` | `execute_step_wrap_token` | Wraps an SPL token into the route vault                                    |

Step accounts are addressed as: `PDA: [b"orchestrator_step", orchestrator_id, step_index]`

There is also a token-specific step initialization path (`initialize_step_token`) for SPL token steps, which records the destination wallet, mint, and amount.

## Step Lifecycle

```
INITIALIZE_ORCHESTRATOR   Create OrchestratorConfig with step sequence
         |
         ▼
INITIALIZE_STEP(S)        Create each OrchestratorStep account with type + execute_at
         |
         ▼
EXECUTE_STEP(S)           Keepers execute each step permissionlessly at the scheduled time
         |
         ▼
CLOSE_STEP(S)             Completed/refunded steps closed to reclaim rent
         |
         ▼
CLOSE_ORCHESTRATOR        Final cleanup — closes OrchestratorConfig, reclaims remaining rent
```

## Failure Recovery

If a step cannot be executed on-chain:

* **`refund_failed_step`** — returns the deposited lamports to the creator. The step must be in a failed state for this to succeed.
* **`rescue_step`** — privileged instruction that bypasses normal constraints to recover funds from a permanently stuck step.

After all steps are either completed or refunded, `close_orchestrator` closes the config account.

## Keeper Incentives

The `keeper_share_bps` field determines how much of each step's deposited funds the executing keeper earns. This is expressed in basis points (1 bps = 0.01%).

For example, with `keeper_share_bps = 50` (0.5%), a step that has 1,000,000 lamports deposited would yield 5,000 lamports to the keeper on successful execution.

This creates open competition for step execution — any operator can run a keeper and earn fees for timely, correct execution.

<Card title="Keepers" icon="person-running" href="/concepts/keepers">
  Learn how keepers monitor and execute pending steps and hops.
</Card>
