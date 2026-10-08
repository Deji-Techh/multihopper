> ## Documentation Index
> Fetch the complete documentation index at: https://dev-docs.multihopper.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Wrapper Tokens

> How MultiHopper routes assets without ever moving original tokens mid-flight

## The Problem with Moving Originals

Routing tokens through multiple recipients directly requires either:

* Trusting each intermediate recipient to forward funds (custodial risk), or
* Requiring every intermediate party to sign each step (coordination overhead)

MultiHopper solves this with a **vault-backed wrapper token** architecture.

## How Wrapper Tokens Work

When a route is funded:

1. **Original tokens are deposited** into a program-controlled vault. They stay there until final redemption.
2. **Wrapper tokens are minted** 1:1 against the vault balance using a Token2022 mint.
3. **The protocol uses the permanent delegate** to move wrapper tokens through the hop sequence without requiring intermediate recipient signatures.
4. **The final recipient redeems** wrapper tokens by burning them, releasing the original tokens from the vault.

Original tokens never move mid-route. Only wrapper tokens flow.

## Token2022 Permanent Delegate

The permanent delegate is a Token2022 extension that grants a designated program the ability to transfer tokens from *any* holder of that mint — without the holder needing to sign.

In MultiHopper, the **MultiHopper Core program** is the permanent delegate for all wrapper mints it creates. This is what enables trustless, programmatic hop execution.

<Warning>
  The permanent delegate is scoped to wrapper tokens only. It has no authority over original tokens in the vault or any other token in a user's wallet.
</Warning>

## Metadata Pointer

Each wrapper mint uses the Token2022 **metadata pointer** extension to store route metadata directly on-chain:

* Hop sequence
* Original token mint
* Vault address
* Route creation timestamp

This makes wrapper tokens self-describing — anyone can inspect a wrapper mint and understand the full route it represents.

## Transfer Hook

A Token2022 **transfer hook** is attached to every wrapper mint. The hook is implemented by the **Transfer Hook Guard** program and runs on every wrapper token transfer, enforcing:

* Only the protocol program can move wrapper tokens (not arbitrary transfers)
* Transfer is within an active, valid route context

## 1:1 Backing Guarantee

At every point in the route lifecycle:

```
wrapper tokens in circulation == original tokens in vault
```

This invariant is maintained by the program logic:

* Minting only occurs when an equal amount is deposited
* Burning only occurs when releasing an equal amount from the vault
* No partial mints or burns are possible

## Why Not Just Use the Original Token?

Using wrapper tokens instead of the original token:

* Keeps original assets in a single, auditable vault
* Avoids requiring recipient signatures at each hop
* Allows the protocol to enforce routing rules at the token level (via transfer hook)
* Normalizes SOL, SPL, and Token2022 tokens into a single interface

<Card title="How It Works" icon="gears" href="/protocol/how-it-works">
  See the full wrapper token flow from deposit through redemption.
</Card>
