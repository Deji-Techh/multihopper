> ## Documentation Index
> Fetch the complete documentation index at: https://dev-docs.multihopper.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Architecture

> Smart contracts, application layer, and system components

## System Overview

MultiHopper is built as a layered system. The protocol layer enforces all routing guarantees on-chain; the application layer provides the tooling to create and monitor routes.

```
User / Integrator
      ↓
  REST API / App
      ↓
 Keeper Network
      ↓
  Smart Contracts (Anchor / Rust)
      ↓
  Solana + Token2022
```

## Smart Contracts

Two on-chain programs implement the protocol:

<CardGroup cols={2}>
  <Card title="MultiHopper Core" icon="microchip">
    **`3jLoS2wbNgtKzieUUxwg6Xhdv6gbZkHDtPWA9ZAgspFh`**

    Handles route creation, hop execution, wrap/unwrap operations, fee collection, provider registration, and fee schedule management. This is the primary program for all route interactions.
  </Card>

  <Card title="Orchestrator" icon="list-check">
    **`4TPCmR2uN3hDM1FbTsf7ZtFXwXGSz4u1Kxv5YHj6eruX`**

    A permissionless execution engine that breaks route deployment into discrete keeper-executable steps. Manages the multi-transaction sequence needed to fund and initialize a route on behalf of the creator.
  </Card>

  <Card title="Transfer Hook Guard" icon="shield-check">
    **`2JEv3pD6nczEvn1xDXaEzehkJofPPjoQQpnW5nGY3r52`**

    Implements the Token2022 transfer hook extension for all wrapper mints. Enforces that only the protocol program can move wrapper tokens and that every transfer occurs within a valid, active route context.
  </Card>
</CardGroup>

### Key On-Chain Accounts

#### MultiHopper Core

| Account             | Seed                                     | Description                                                                                                              |
| ------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `RouteConfig`       | `[b"route", route_id_le_bytes]`          | Stores the full route definition: hop sequence, recipients, amounts, timing, prepaid hops, provider, and execution state |
| `RouteState`        | `[b"state", route_id_le_bytes]`          | Mutable execution state for the route — tracks hop progress and finalization                                             |
| `PermanentDelegate` | `[b"delegate", route_id_le_bytes]`       | PDA holding permanent delegate authority over the wrapper mint                                                           |
| `Vault` (SPL)       | `[b"vault_authority", original_mint]`    | Program-controlled token account holding original deposited SPL tokens                                                   |
| `SolVault`          | `[b"sol_vault", token_config_creator]`   | Program-controlled lamport vault for SOL routes                                                                          |
| `WrapperMint`       | `[b"mint_authority", route_id_le_bytes]` | Token2022 mint with permanent delegate, metadata pointer, and transfer hook extensions                                   |
| `TokenConfig`       | `[b"token_config_global_v2"]`            | Global token configuration account                                                                                       |
| `Provider`          | `[b"provider", provider_id]`             | Integrator registration — stores provider wallet and ID                                                                  |
| `FeeSchedule`       | `[b"fee_schedule", provider_id]`         | Tiered fee tiers for a registered provider                                                                               |

#### Orchestrator

| Account              | Seed                                     | Description                                                                          |
| -------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------ |
| `OrchestratorConfig` | `[b"orchestrator"]`                      | Stores the full step sequence, keeper share in basis points, step count, and creator |
| `OrchestratorStep`   | `[b"step", orchestrator_id, step_index]` | Individual step with type, execute\_at timestamp, and execution state                |

## Application Layer

| Component     | Technology                                          | Purpose                                                      |
| ------------- | --------------------------------------------------- | ------------------------------------------------------------ |
| **Web App**   | React 18/19, Vite, TailwindCSS                      | Route creation UI, wallet connection, transaction signing    |
| **API**       | Fastify, tRPC (internal), REST `/api/v1` (external) | Transaction building, route management                       |
| **Scheduler** | Node.js cron                                        | Monitors pending steps and hops, submits keeper transactions |
| **Indexer**   | Custom ETL                                          | On-chain event indexing for real-time route status tracking  |
| **Database**  | PostgreSQL, Drizzle ORM                             | Route state, user data, execution history                    |

## Monorepo Structure

The codebase is organized as a Turborepo monorepo:

```
multihopper/
├── apps/
│   ├── web/          # React frontend
│   └── api/          # Fastify API server
├── libs/
│   ├── server/       # tRPC routers and server logic
│   └── shared/       # Shared types and utilities
```

The Anchor programs live in a separate `multihopper-contracts` repository.

## Full Tech Stack

| Layer               | Technologies                                              |
| ------------------- | --------------------------------------------------------- |
| **Smart Contracts** | Anchor, Rust, Token2022 (spl-token-2022)                  |
| **Frontend**        | React 18/19, Vite, TanStack Router, Solana Wallet Adapter |
| **Backend**         | Fastify, tRPC, Drizzle ORM, PostgreSQL                    |
| **Infrastructure**  | Turborepo, TypeScript, Docker                             |

## Architectural Principles

**Distribution and execution are intentionally separated.** The abstraction layer handles asset routing and intermediate wallet coordination. The hop execution engine handles sequenced transfers. This separation allows each layer to evolve independently and makes the security boundary cleaner.

**Permissionless execution.** No single entity controls whether a route executes. Any keeper can trigger orchestrator steps or hop executions — the program validates correctness, not identity.

**Off-chain indexing, on-chain authority.** The indexer and API provide a convenient read layer, but they hold no authority over funds. All state that matters for settlement is on-chain.

**Provider extensibility.** Integrators can register as providers via `register_provider`, attach a `provider_id` to routes, and configure per-provider fee tiers via `initialize_fee_schedule` / `update_fee_schedule`.
