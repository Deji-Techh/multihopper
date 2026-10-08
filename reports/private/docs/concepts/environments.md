> ## Documentation Index
> Fetch the complete documentation index at: https://dev-docs.multihopper.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Environments

> Devnet vs production — base URLs, dashboards, and API keys for each

MultiHopper runs two independent environments. They are fully separate deployments:
a key, integration, or route from one does **not** exist in the other. Pick the
environment first, then use its base URL **and** its dashboard throughout.

|                    | Devnet (testing)                                                                                 | Production (mainnet)                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| **Base URL**       | `https://devnet.multihopper.com/api/v1`                                                          | `https://multihopper.com/api/v1`                                                   |
| **Dashboard**      | [devnet.multihopper.com/developer/dashboard](https://devnet.multihopper.com/developer/dashboard) | [multihopper.com/developer/dashboard](https://multihopper.com/developer/dashboard) |
| **API keys**       | `mh_test_…` only                                                                                 | `mh_live_…` and `mh_test_…`                                                        |
| **Solana cluster** | devnet                                                                                           | mainnet-beta                                                                       |
| **Funds**          | devnet SOL / test tokens                                                                         | real assets                                                                        |

<Warning>
  Each environment **only issues its own keys**, and a key is bound to the cluster of the
  deployment that minted it — it is not switched by the key prefix. To build against
  Solana devnet you must create your key from the **devnet** dashboard above; a key minted
  on the production dashboard will not work against devnet.
</Warning>

## Which one should I use?

Start on **devnet** while you build and test — it uses devnet SOL, so mistakes cost
nothing. Move to **production** once your integration works end to end.

The [Quickstart](/quickstart) and the interactive [API Reference](/api-reference/introduction)
both default to production; use the **server dropdown** at the top of any API Reference page
to switch the examples to devnet.

## Compliance differs by environment

TRM compliance screening is enabled per environment. It is currently **on for mainnet** and
may be toggled on devnet for testing. See [Compliance & screening](/concepts/compliance)
for what that means for fees and denied routes.
