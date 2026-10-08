> ## Documentation Index
> Fetch the complete documentation index at: https://dev-docs.multihopper.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Routes

> The core primitive — a programmable, sequenced token transfer pipeline

## What is a Route?

A **route** is the fundamental unit of MultiHopper. It defines a complete token transfer pipeline: a sequence of recipients and execution times that play out automatically on-chain after the route is funded.

Think of a route as a smart payment program you deploy once and let run.

## RouteConfig Fields

The `RouteConfig` on-chain account stores the full route definition:

| Field              | Type               | Description                                                                                    |
| ------------------ | ------------------ | ---------------------------------------------------------------------------------------------- |
| `route_id`         | `[u8; 32]`         | Unique 32-byte route identifier                                                                |
| `creator`          | `Pubkey`           | Wallet that created the route                                                                  |
| `original_mint`    | `Pubkey`           | Mint address of the deposited token (or native SOL mint)                                       |
| `route_token_mint` | `Pubkey`           | Token2022 wrapper mint address                                                                 |
| `mint_authority`   | `Pubkey`           | PDA with authority to mint/burn wrapper tokens                                                 |
| `source_owner`     | `Option<Pubkey>`   | Optional source wallet — used by the abstraction path to link the route to an origin wallet    |
| `hops`             | `Vec<Hop>`         | Ordered list of transfer steps (up to 64 hops)                                                 |
| `hop_amount`       | `u64`              | Single token amount shared across all hops (in base units)                                     |
| `is_finalized`     | `bool`             | Whether the route has been fully initialized and locked                                        |
| `created_at`       | `i64`              | Unix timestamp of route creation                                                               |
| `prepaid_hops`     | `u8`               | Number of hops that protocol fees have been paid for — execution is rejected beyond this limit |
| `provider_id`      | `Option<[u8; 16]>` | Optional integrator identifier from a registered Provider account                              |
| `reference_id`     | `Option<[u8; 16]>` | Optional external reference ID set by the integrator                                           |

### Hops

Each hop within a route specifies:

| Field        | Description                                         |
| ------------ | --------------------------------------------------- |
| `recipient`  | Solana wallet address receiving tokens at this step |
| `execute_at` | Unix timestamp — the earliest this hop can execute  |

## Route Variants

Two route creation instructions exist depending on the asset type:

| Instruction                     | Use Case                                                       |
| ------------------------------- | -------------------------------------------------------------- |
| `initialize_route`              | SPL token routes                                               |
| `initialize_route_sol`          | Native SOL routes (uses a dedicated `sol_vault` PDA)           |
| `initialize_route_provider`     | SPL route with a registered provider and optional reference ID |
| `initialize_route_provider_sol` | SOL route with a registered provider and optional reference ID |

## Route Constraints

* Routes are **immutable** after finalization. The hop sequence, recipients, and timing cannot be changed.
* Hops execute in **strict order**. Hop `N` cannot run until hop `N-1` is complete.
* Timing is enforced by the **Solana clock** on-chain. No hop can run before its `execute_at` time.
* Execution is gated by **`prepaid_hops`** — only hops within the prepaid count can execute.

## Route Limits

| Constraint             | Value               |
| ---------------------- | ------------------- |
| Maximum hops per route | 64                  |
| Supported tokens       | SOL, SPL, Token2022 |

## Closing a Route

Once a route is fully settled (all hops complete, vault emptied), the `close_route` instruction reclaims the `RouteConfig` account rent and returns lamports to the creator.

## Identifying Routes

Each route is identified by its `route_id` — a 32-byte UUID stored as a 64-character hex string (e.g. `a1b2c3d4e5f6...`). The on-chain account address is derived as:

```
PDA: [b"route", route_id_le_bytes]
```

where `route_id_le_bytes` is the little-endian byte representation of the route ID. Use this ID to query route status via the API or track on-chain state.

<Card title="Route Lifecycle" icon="arrows-spin" href="/protocol/route-lifecycle">
  See how routes move from creation through settlement.
</Card>
