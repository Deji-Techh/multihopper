> ## Documentation Index
> Fetch the complete documentation index at: https://dev-docs.multihopper.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Route Lifecycle

> From route creation through final settlement — step by step

Every MultiHopper route moves through four stages: **Create → Deploy → Execute → Unwrap**.

## Lifecycle Diagram

```
CREATE       User defines route: recipients, amounts, timing, provider
    |
    ▼
DEPLOY       Orchestrator steps fund the route; wrapper tokens minted 1:1
    |
    ▼
EXECUTE      Hops trigger at scheduled times (on-chain timelocks enforced)
    |
    ▼
UNWRAP       Final recipient burns wrapper tokens; original tokens released
```

## Stage 1: Create

The user (or integrator via API) defines the route:

* **Asset** — the token to route (SOL or SPL)
* **Hop sequence** — an ordered list of recipients and timing
* **`hop_amount`** — a single amount shared across all hops
* **`source_owner`** — optional source wallet for abstraction (intermediate funding)
* **`prepaid_hops`** — how many hops have been fee-paid upfront
* **`provider_id`** / **`reference_id`** — optional integrator and external reference IDs

A `RouteConfig` account is created on-chain storing the full definition. The route ID is a 32-byte identifier (`[u8; 32]`).

<Tip>
  Routes are immutable after creation. Plan your hop sequence carefully before submitting.
</Tip>

## Stage 2: Deploy (Orchestrator)

Route deployment uses the **Orchestrator program** to coordinate the multi-transaction funding sequence. This is handled transparently by the app or API — integrators do not need to manage individual steps.

### How the Orchestrator Works

1. An `OrchestratorConfig` account is created with the full step sequence, `keeper_share_bps` incentive, and step count.
2. Individual `OrchestratorStep` accounts are initialized — each with a type and `execute_at` timestamp:
   * **`transfer`** — transfer SOL/lamports between accounts to fund intermediate wallets
   * **`wrap_sol`** — wrap SOL into the route vault via the Core program
   * **`wrap_token`** — wrap an SPL token into the route vault
3. Keepers execute each step permissionlessly once its scheduled time arrives. Each successful keeper earns a share of deposited funds proportional to `keeper_share_bps`.
4. After all steps complete, the orchestrator is closed and remaining rent is reclaimed.

### Abstraction

When a route is deployed via the abstraction path, intermediate wallets are funded through the orchestrator's `transfer` steps. This allows the source of funds to be separated from the final route configuration — the intermediate wallets facilitate the on-chain setup without directly linking the origin wallet to the final route state.

## Stage 3: Execute

Hops trigger according to the on-chain schedule. For each hop:

1. A keeper submits a `trigger_hop` instruction to the Core program
2. The program validates:
   * Current Solana clock ≥ `execute_at` for this hop
   * Previous hop is complete
   * Hop is within the `prepaid_hops` limit
3. The permanent delegate transfers wrapper tokens from the current recipient to the next
4. The hop is marked complete on-chain

This repeats for every hop in the sequence.

<Note>
  Execution is permissionless — any keeper can submit a valid hop execution. The program enforces all constraints; the keeper cannot deviate from the route definition.
</Note>

## Stage 4: Unwrap

After the final hop completes, the last recipient can redeem:

1. Submit an `unwrap` (SPL) or `unwrap_sol` (SOL) instruction with their wrapper tokens
2. The program burns the wrapper tokens
3. The equivalent original tokens are released from the vault to the recipient

The route is now **settled**. The `close_route` instruction can be called to reclaim the account rent once the route is fully settled.

## Failure Cases

<AccordionGroup>
  <Accordion title="Hop executed too early" icon="xmark">
    The transaction fails with a clock constraint error. The hop stays pending. Any executor can retry after the scheduled time.
  </Accordion>

  <Accordion title="Keeper goes offline" icon="xmark">
    The hop or step stays pending. Any other executor can trigger it. Routes do not expire.
  </Accordion>

  <Accordion title="Orchestrator step fails on-chain" icon="xmark">
    The `refund_failed_step` instruction on the Orchestrator returns deposited funds to the creator. The `rescue_step` instruction is available as an admin escape hatch for permanently stuck steps.
  </Accordion>

  <Accordion title="Recipient account missing" icon="xmark">
    The executor must ensure recipient token accounts exist before submitting. Standard ATA creation applies.
  </Accordion>
</AccordionGroup>
