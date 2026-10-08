> ## Documentation Index
> Fetch the complete documentation index at: https://dev-docs.multihopper.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Compliance & screening

> How TRM compliance screening works, what it costs, and what builders need to do

On networks where compliance is enabled (mainnet today), every route is screened against
sanctions and risk data before its funds move. Screening is **automatic and enforced on-chain** —
as a builder you do not run, attach, or sign anything to "pass" it. This page covers the two things
you *do* need to account for: the **screening fee** and the **verification window** (plus what
happens on a denial).

<Note>
  **You take no action to pass screening.** The MultiHopper keeper screens the route and submits
  the on-chain verification for you. The only builder-facing impacts are funding the screening fee
  and tolerating a short verification delay before hops execute.
</Note>

## What gets screened

When the gate is on, the route's **origin** (the `sourceOwner` / funding wallet) and **every
recipient** in the route — including the final `recipientWallet` and all intermediate hops — are
screened together. The set is cryptographically bound to the route, so funds cannot be screened
against one set of addresses and then moved to another.

## The screening fee

| Property            | Value                                                                                              |
| ------------------- | -------------------------------------------------------------------------------------------------- |
| Amount              | A flat per-deploy fee — **currently 0.002 SOL on mainnet** (a configured value, subject to change) |
| Paid by             | `sourceOwner` (the signing wallet)                                                                 |
| Charged when        | At deploy, inside the `/prepare` transaction bundle                                                |
| Charged if flagged? | **Yes** — the fee is collected regardless of the screening outcome                                 |
| Refunded?           | Yes for a clean (verified) route — the deposit is returned to `sourceOwner` on verification        |
| In `/estimate`?     | **No** — you must add it on top of the estimate yourself                                           |

<Note>
  The fee is a refundable anti-abuse deposit, not a fixed protocol constant: a clean route gets it
  back when screening verifies, while a flagged route forfeits it. The amount is configured per
  network and may change, so treat 0.002 SOL as the current mainnet value rather than a guarantee.
</Note>

<Warning>
  The fee is **not** returned by [`/estimate`](/api-reference/transfers/estimate), but it **is**
  charged by [`/prepare`](/api-reference/transfers/prepare). Ensure the `sourceOwner` wallet holds
  **transfer amount + protocol fees + account rent + keeper funding + 0.002 SOL** before signing,
  or the deploy can fail for insufficient lamports. This is the most common reason a route fails to
  deploy on mainnet.
</Warning>

## Lifecycle

```
create → prepare → sign + broadcast → confirm-broadcast
                                            │
                                            ▼
                              (route deployed, fee charged)
                                            │
                            keeper screens + verifies on-chain
                                            │
                        ┌───────────────────┴───────────────────┐
                        ▼                                        ▼
                   verified                                   flagged
                hops execute                          principal refunded,
              status → completed                       fee retained,
                                                      status → refunded
```

After your final [`confirm-broadcast`](/api-reference/transfers/confirm-broadcast), the transfer
sits in `processing` while the keeper screens the route and submits the on-chain verification. This
typically takes a few seconds. Once verified, hops begin executing and the transfer proceeds to
`completed` as normal. **Keep polling [`GET /transfers/{id}`](/api-reference/transfers/get) — no
action is required during this window.**

## When a wallet is flagged

If any screened address is flagged, the route is **not** executed:

* The **principal is refunded** to the `sourceOwner`.
* The **screening fee is retained**.
* The transfer ends in `refunded` status.
* For privacy and legal reasons, the specific reason for a flag is **not disclosed**.

## Enforced on-chain — not by the API

Compliance is a property of the deployed smart contract, not the API server or keeper. The required
compliance account is mandatory on every fund-moving instruction, and the program refuses to move
funds for a route that has not been verified while the gate is on. This means a route **cannot be
constructed to bypass screening**, whether it is built through this API or by hand. See the
[Security Model](/concepts/security) for the underlying guarantees.

## Networks

* **Mainnet** — the gate is **on**. Screening and the fee apply as described above.
* **Test mode** (`mh_test_*` keys) — use test-mode keys to integrate against the lifecycle without
  moving real value. Verify that your wallet budgets for the fee and that your code keeps polling
  through the verification window.
