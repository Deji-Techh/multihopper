> ## Documentation Index
> Fetch the complete documentation index at: https://dev-docs.multihopper.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Keepers

> Permissionless executors that trigger hop and orchestrator step execution on-chain

## What is a Keeper?

A **keeper** is any off-chain process that monitors pending MultiHopper hops and orchestrator steps, then submits the corresponding on-chain transaction when the scheduled time arrives.

Keepers are the "automation layer" of the protocol — they bridge the gap between on-chain timelock enforcement and real-world execution timing.

## What Keepers Execute

Keepers interact with two programs:

### MultiHopper Core — Hop Execution

```
1. Keeper monitors route state (via API or on-chain)
2. A hop's execute_at time is reached
3. Keeper submits trigger_hop transaction to the Core program
4. Program validates: timing, sequencing, prepaid_hops limit
5. On success: wrapper tokens transfer to next recipient, hop marked complete
6. On failure: transaction reverts, no state change
```

### Orchestrator — Step Execution

```
1. Keeper monitors OrchestratorStep accounts
2. A step's execute_at time is reached
3. Keeper submits the appropriate step instruction:
   - execute_step_transfer     → move lamports between accounts
   - execute_step_wrap_sol     → wrap SOL into the route vault
   - execute_step_token_transfer / execute_step_wrap_token → SPL token operations
4. On success: step marked complete, keeper earns keeper_share_bps of deposited funds
5. remaining_steps on OrchestratorConfig decrements
```

The keeper has no authority over funds. Both programs enforce all constraints — keepers only provide the trigger.

## Permissionless Execution

Execution is **permissionless**: any wallet can submit a valid step or hop execution. The programs validate correctness independently of who submits.

<Tip>
  If a designated keeper goes offline, any other executor can pick up pending steps and hops. Routes and orchestrators do not expire due to keeper failures.
</Tip>

## Keeper Incentives

The `OrchestratorConfig` account includes a `keeper_share_bps` field (basis points). When a keeper successfully executes an orchestrator step, they earn a proportional share of the lamports deposited for that step.

This creates an open, competitive market for route deployment execution — anyone can run a keeper and earn fees for timely execution.

## Current Keeper Infrastructure

MultiHopper operates a **scheduler service** (a Node.js cron process) that automatically monitors all active routes and orchestrators and submits executions at the scheduled time.

This scheduler is:

* Non-custodial — it can trigger steps and hops but cannot redirect funds
* Redundant — execution remains possible without it since any keeper can act
* Observable — execution history is indexed and queryable via the API

## Failure Recovery

If an orchestrator step fails on-chain:

* **`refund_failed_step`** — returns deposited funds to the route creator
* **`rescue_step`** — admin escape hatch for permanently stuck steps (requires privileged authority)
* **`close_step`** — closes a completed or refunded step account to reclaim rent

After all steps are resolved, `close_orchestrator` reclaims the `OrchestratorConfig` account rent.

<Card title="Orchestrator" icon="list-check" href="/concepts/orchestrator">
  Learn how the Orchestrator program coordinates multi-step route deployment.
</Card>
