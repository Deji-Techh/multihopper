> ## Documentation Index
> Fetch the complete documentation index at: https://dev-docs.multihopper.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Agentic Integration

> Run autonomous multi-hop transfers from an agent or automated backend

## Overview

When integrating Multihopper into an automated or agentic workflow, the transfer lifecycle splits into two distinct halves:

* **API-managed** — create, prepare, confirm-broadcast, and monitor via REST
* **Client-managed** — sign and broadcast transactions to Solana (requires wallet access)

The sign and broadcast steps are intentionally handled client-side: your private key never leaves your environment.

## Transfer lifecycle for agents

```
1. POST /transfers                        → create transfer, receive transferId
2. POST /transfers/:id/prepare            → receive preparedTxs (unsigned base64 txs)
3. [CLIENT] Sign and broadcast keeperFundingTx FIRST
4. POST /transfers/:id/confirm-broadcast  → record keeperFundingSignature immediately
5. [CLIENT] Sign and broadcast routeInitTxs → orchestratorInitTx → sessionInitTxs in order
6. POST /transfers/:id/confirm-broadcast  → record remaining signatures, activate transfer
7. GET  /transfers/:id                    → poll until completed | failed
```

Steps 3 and 5 happen entirely outside the API. No private key material is sent to the server.

`confirm-broadcast` is called **twice**: once immediately after `keeperFundingTx` (step 4), and once after the rest (step 6). This prevents double-funding if deployment is interrupted and `/prepare` is called again.

***

## Transaction signing

`preparedTxs` contains four groups of transactions that must be signed in order. Each group uses either a VersionedTransaction (v0) or a legacy Transaction — the signing approach differs.

| Field                | Tx type                   | Broadcast order | Notes                                                                             |
| -------------------- | ------------------------- | --------------- | --------------------------------------------------------------------------------- |
| `keeperFundingTx`    | VersionedTransaction (v0) | **1st**         | Broadcast and confirm first; record signature immediately via `confirm-broadcast` |
| `routeInitTxs[]`     | VersionedTransaction (v0) | 2nd             | Server pre-signs ephemeral keys; preserve existing sigs                           |
| `orchestratorInitTx` | Legacy Transaction        | 3rd             | Plain partial sign                                                                |
| `sessionInitTxs[]`   | VersionedTransaction (v0) | 4th             | Server pre-signs; preserve existing sigs                                          |

<Warning>
  The server partially pre-signs VersionedTransactions with ephemeral keypairs. Your signing step must **add your signature** to the existing slot without overwriting the server's partial signatures.
</Warning>

Any field that is `null` in `preparedTxs` is already confirmed on-chain from a previous broadcast attempt — skip it.

### Python

**Dependencies:** `pip install solders base58`

```python theme={null}
import base64
from solders.keypair import Keypair
from solders.transaction import VersionedTransaction, Transaction
import base58

def load_keypair(private_key_base58: str) -> Keypair:
    secret = base58.b58decode(private_key_base58)
    return Keypair.from_bytes(secret)

def sign_versioned(base64_tx: str, keypair: Keypair) -> str:
    """Sign a VersionedTransaction (v0), preserving existing partial signatures."""
    tx = VersionedTransaction.from_bytes(base64.b64decode(base64_tx))
    # v0 signing payload: version prefix byte (0x80) + serialised message bytes
    msg_bytes = bytes([0x80]) + bytes(tx.message)
    our_sig = keypair.sign_message(msg_bytes)
    # Find our pubkey's slot in the signature array and replace only that entry
    account_keys = list(tx.message.account_keys)
    idx = next(i for i, k in enumerate(account_keys) if k == keypair.pubkey())
    sigs = list(tx.signatures)
    sigs[idx] = our_sig
    return base64.b64encode(bytes(VersionedTransaction.populate(tx.message, sigs))).decode()

def sign_legacy(base64_tx: str, keypair: Keypair) -> str:
    """Sign a legacy Transaction."""
    tx = Transaction.from_bytes(base64.b64decode(base64_tx))
    tx.partial_sign([keypair], tx.message.recent_blockhash)
    return base64.b64encode(bytes(tx)).decode()

def sign_prepared_txs(prepared_txs: dict, keypair: Keypair) -> dict:
    signed = {}
    if prepared_txs.get("routeInitTxs"):
        signed["routeInitTxs"] = [
            {"base64": sign_versioned(e["base64"], keypair)}
            for e in prepared_txs["routeInitTxs"]
        ]
    if prepared_txs.get("orchestratorInitTx"):
        signed["orchestratorInitTx"] = sign_legacy(
            prepared_txs["orchestratorInitTx"], keypair
        )
    if prepared_txs.get("sessionInitTxs"):
        signed["sessionInitTxs"] = [
            sign_versioned(b, keypair) for b in prepared_txs["sessionInitTxs"]
        ]
    if prepared_txs.get("keeperFundingTx"):
        signed["keeperFundingTx"] = sign_versioned(
            prepared_txs["keeperFundingTx"], keypair
        )
    return signed
```

### TypeScript

**Dependencies:** `npm install @solana/web3.js bs58`

```typescript theme={null}
import { Keypair, VersionedTransaction, Transaction } from "@solana/web3.js";

function signVersioned(base64Tx: string, keypair: Keypair): string {
  const tx = VersionedTransaction.deserialize(Buffer.from(base64Tx, "base64"));
  tx.sign([keypair]);
  return Buffer.from(tx.serialize()).toString("base64");
}

function signLegacy(base64Tx: string, keypair: Keypair): string {
  const tx = Transaction.from(Buffer.from(base64Tx, "base64"));
  tx.partialSign(keypair);
  return Buffer.from(tx.serialize({ requireAllSignatures: false })).toString("base64");
}

interface PreparedTxs {
  routeInitTxs?: { base64: string }[] | null;
  orchestratorInitTx?: string | null;
  sessionInitTxs?: string[] | null;
  keeperFundingTx?: string | null;
}

function signPreparedTxs(preparedTxs: PreparedTxs, keypair: Keypair): PreparedTxs {
  const signed: PreparedTxs = {};
  if (preparedTxs.routeInitTxs?.length) {
    signed.routeInitTxs = preparedTxs.routeInitTxs.map(e => ({
      base64: signVersioned(e.base64, keypair),
    }));
  }
  if (preparedTxs.orchestratorInitTx) {
    signed.orchestratorInitTx = signLegacy(preparedTxs.orchestratorInitTx, keypair);
  }
  if (preparedTxs.sessionInitTxs?.length) {
    signed.sessionInitTxs = preparedTxs.sessionInitTxs.map(b =>
      signVersioned(b, keypair)
    );
  }
  if (preparedTxs.keeperFundingTx) {
    signed.keeperFundingTx = signVersioned(preparedTxs.keeperFundingTx, keypair);
  }
  return signed;
}
```

***

## Broadcasting to Solana

Signed transactions must be broadcast in a strict order. Each group must reach `confirmed` status before the next group is sent — later transactions depend on accounts created by earlier ones.

### Broadcast order

```
keeperFundingTx  →  routeInitTxs[0..N]  →  orchestratorInitTx  →  sessionInitTxs[0..N]
```

<Warning>
  **`keeperFundingTx` must be broadcast and confirmed first.** Call `confirm-broadcast` with just the `keeperFundingSignature` immediately after — before broadcasting anything else. This is required to prevent double-funding if deployment is interrupted.
</Warning>

<Warning>
  Wait for each `routeInitTx` to reach `confirmed` before broadcasting the next one. Allow an additional 3 seconds after the last `routeInitTx` and after `orchestratorInitTx` for account state to propagate across RPC nodes, especially on devnet.
</Warning>

### Python

```python theme={null}
import time
import requests

def broadcast_and_confirm(base64_tx: str, label: str, rpc_url: str) -> str:
    """Send a signed transaction to the RPC and wait for confirmation."""
    resp = requests.post(rpc_url, json={
        "jsonrpc": "2.0", "id": 1,
        "method": "sendTransaction",
        "params": [base64_tx, {"encoding": "base64", "skipPreflight": False}],
    }, timeout=30)
    resp.raise_for_status()
    result = resp.json()
    if "error" in result:
        raise RuntimeError(f"{label} failed: {result['error']}")
    sig = result["result"]
    print(f"  {label}: {sig}")
    for _ in range(12):
        time.sleep(5)
        status = requests.post(rpc_url, json={
            "jsonrpc": "2.0", "id": 1,
            "method": "getSignatureStatuses",
            "params": [[sig], {"searchTransactionHistory": True}],
        }, timeout=30).json()
        val = (status.get("result", {}).get("value") or [None])[0]
        if val and val.get("confirmationStatus") in ("confirmed", "finalized"):
            return sig
    return sig  # proceed after 60s timeout

def broadcast_signed_txs(
    signed: dict, rpc_url: str, transfer_id: int, api_base: str, api_headers: dict
) -> dict:
    """Broadcast all signed transactions in the correct order.
    Calls confirm-broadcast immediately after keeperFundingTx to prevent double-funding.
    Returns the final confirm-broadcast body."""
    import uuid
    signatures: dict = {}

    # 1. keeperFundingTx FIRST — record immediately
    if signed.get("keeperFundingTx"):
        sig = broadcast_and_confirm(signed["keeperFundingTx"], "keeperFundingTx", rpc_url)
        signatures["keeperFundingSignature"] = sig
        requests.post(
            f"{api_base}/api/v1/transfers/{transfer_id}/confirm-broadcast",
            json={"routeInitSignatures": [], "keeperFundingSignature": sig},
            headers={**api_headers, "Idempotency-Key": str(uuid.uuid4())},
            timeout=30,
        ).raise_for_status()

    # 2. routeInitTxs
    route_sigs = []
    for i, entry in enumerate(signed.get("routeInitTxs") or []):
        sig = broadcast_and_confirm(entry["base64"], f"routeInitTxs[{i}]", rpc_url)
        route_sigs.append(sig)
        if i < len(signed["routeInitTxs"]) - 1:
            time.sleep(3)
    if route_sigs:
        signatures["routeInitSignatures"] = route_sigs
        time.sleep(3)

    # 3. orchestratorInitTx
    if signed.get("orchestratorInitTx"):
        sig = broadcast_and_confirm(signed["orchestratorInitTx"], "orchestratorInitTx", rpc_url)
        signatures["orchestratorInitSignature"] = sig
        time.sleep(3)

    # 4. sessionInitTxs
    session_sigs = []
    for i, b64 in enumerate(signed.get("sessionInitTxs") or []):
        sig = broadcast_and_confirm(b64, f"sessionInitTxs[{i}]", rpc_url)
        session_sigs.append(sig)
    if session_sigs:
        signatures["sessionInitSignatures"] = session_sigs

    return signatures
```

### TypeScript

```typescript theme={null}
import { Connection } from "@solana/web3.js";

const connection = new Connection(process.env.SOLANA_RPC_URL!, "confirmed");

async function broadcastAndConfirm(base64Tx: string, label: string): Promise<string> {
  const sig = await connection.sendRawTransaction(
    Buffer.from(base64Tx, "base64"),
    { skipPreflight: false }
  );
  console.log(`  ${label}: ${sig}`);
  await connection.confirmTransaction(sig, "confirmed");
  return sig;
}

async function broadcastSignedTxs(
  signed: PreparedTxs,
  confirmBroadcast: (body: Record<string, unknown>) => Promise<void>
): Promise<Record<string, unknown>> {
  const signatures: Record<string, unknown> = {};

  // 1. keeperFundingTx FIRST — record immediately to prevent double-funding on resume
  if (signed.keeperFundingTx) {
    const sig = await broadcastAndConfirm(signed.keeperFundingTx, "keeperFundingTx");
    signatures.keeperFundingSignature = sig;
    await confirmBroadcast({ routeInitSignatures: [], keeperFundingSignature: sig });
  }

  // 2. routeInitTxs
  const routeSigs: string[] = [];
  for (let i = 0; i < (signed.routeInitTxs?.length ?? 0); i++) {
    const sig = await broadcastAndConfirm(signed.routeInitTxs![i].base64, `routeInitTxs[${i}]`);
    routeSigs.push(sig);
    if (i < signed.routeInitTxs!.length - 1) {
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  if (routeSigs.length) {
    signatures.routeInitSignatures = routeSigs;
    await new Promise(r => setTimeout(r, 3000));
  }

  // 3. orchestratorInitTx
  if (signed.orchestratorInitTx) {
    const sig = await broadcastAndConfirm(signed.orchestratorInitTx, "orchestratorInitTx");
    signatures.orchestratorInitSignature = sig;
    await new Promise(r => setTimeout(r, 3000));
  }

  // 4. sessionInitTxs
  const sessionSigs: string[] = [];
  for (const [i, b64] of (signed.sessionInitTxs ?? []).entries()) {
    sessionSigs.push(await broadcastAndConfirm(b64, `sessionInitTxs[${i}]`));
  }
  if (sessionSigs.length) signatures.sessionInitSignatures = sessionSigs;

  return signatures;
}
```

***

## Handling expiry and resume

Solana blockhashes expire roughly 60 seconds after the `/prepare` call. If broadcast fails mid-way — due to expiry, an RPC error, or a process crash — call `/prepare` again with a **new `Idempotency-Key`**.

The server inspects the chain and returns `null` for any group already confirmed. The signing and broadcast helpers above skip `null` fields automatically.

```json theme={null}
{
  "preparedTxs": {
    "routeInitTxs": null,            // already on-chain — skip
    "orchestratorInitTx": null,      // already on-chain — skip
    "sessionInitTxs": ["AQAAAA..."], // still needed
    "keeperFundingTx": "AQAAAA..."   // still needed
  }
}
```

Repeat: sign the non-null fields → broadcast → confirm-broadcast. The server merges with the existing on-chain state.

***

## Compliance & screening

On compliance-enabled networks (mainnet today) every route is screened against sanctions/risk data
**automatically, after deployment, by the keeper** — your agent does nothing to "pass" screening.
Two things to account for:

* **Budget the screening fee.** A flat screening fee (currently **0.002 SOL** on mainnet, a
  configured value) is taken from `sourceOwner` at deploy by the `/prepare` bundle and is **not**
  included in `/estimate`. It's a refundable anti-abuse deposit — a clean route gets it back on
  verification, a flagged route forfeits it — but the wallet must hold it at deploy time on top of
  the transfer amount, protocol fees, account rent, and keeper funding, or the deploy can fail for
  insufficient lamports.
* **Expect a short verification window.** After your final `confirm-broadcast`, the transfer sits in
  `processing` while the keeper verifies compliance, then hops begin executing. Keep polling — no
  action is needed. If a wallet is flagged, the transfer ends as `refunded`: the principal is
  returned and the screening fee is retained.

See [Compliance & screening](/concepts/compliance) for the full lifecycle.

***

## Full autonomous loop (TypeScript)

```typescript theme={null}
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

const API_BASE = "https://multihopper.com";
const API_KEY  = process.env.MH_API_KEY!;
const keypair  = Keypair.fromSecretKey(bs58.decode(process.env.SOLANA_PRIVATE_KEY!));
const headers  = { "x-api-key": API_KEY, "Content-Type": "application/json" };

async function mhTransfer(params: {
  sourceOwner: string;
  recipientWallet: string;
  amountRaw: string;
  amountTokens: string;
  tokenMint: string;
  tokenDecimals: number;
  tokenSymbol?: string;
  hops?: number;
  arrivalSeconds?: number;
}) {
  // 1. Create
  const transfer = await fetch(`${API_BASE}/api/v1/transfers`, {
    method: "POST",
    headers: { ...headers, "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify(params),
  }).then(r => r.json());

  const id = transfer.id;

  // Helper: call confirm-broadcast
  const confirmBroadcast = async (body: Record<string, unknown>) => {
    await fetch(`${API_BASE}/api/v1/transfers/${id}/confirm-broadcast`, {
      method: "POST",
      headers: { ...headers, "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify(body),
    });
  };

  // 2. Prepare → sign → broadcast (with retry on expiry)
  // broadcastSignedTxs calls confirmBroadcast once immediately after keeperFundingTx.
  let broadcastSignatures: Record<string, unknown> = {};
  let attempts = 0;

  while (true) {
    if (attempts++ > 3) throw new Error("Too many prepare attempts");

    const { preparedTxs } = await fetch(`${API_BASE}/api/v1/transfers/${id}/prepare`, {
      method: "POST",
      headers: { ...headers, "Idempotency-Key": crypto.randomUUID() },
    }).then(r => r.json());

    if (preparedTxs.resume?.nothingToDo) break;

    const signed = signPreparedTxs(preparedTxs, keypair);
    const sigs = await broadcastSignedTxs(signed, confirmBroadcast);
    broadcastSignatures = { ...broadcastSignatures, ...sigs };
    if (!preparedTxs.resume?.routeAlreadyDeployed) break;
  }

  // 3. Final confirm-broadcast with all remaining signatures
  await confirmBroadcast(broadcastSignatures);

  // 4. Poll until settled
  while (true) {
    const { transfer: t } = await fetch(`${API_BASE}/api/v1/transfers/${id}`, { headers })
      .then(r => r.json());
    console.log(`  status: ${t.status}  progress: ${t.progress.hopsCompleted}/${t.progress.hopsTotal}`);
    if (["completed", "failed", "expired"].includes(t.status)) return t;
    await new Promise(r => setTimeout(r, 5000));
  }
}
```

***

## Agent context file (CLAUDE.md)

Drop the block below into your project's `CLAUDE.md` (or any system prompt / context file your agent reads). It gives the agent everything it needs to call MultiHopper correctly without hallucinating endpoints or field names.

```markdown theme={null}
# MultiHopper

REST API: https://multihopper.com/api/v1
Auth: x-api-key header — mh_live_... (live) or mh_test_... (test)

## Transfer flow — 3 API calls

### 1. Create
POST /transfers
Required fields: tokenMint, amountRaw, amountTokens, sourceOwner (sender wallet),
  recipientWallet, hops (integer, 3–10), arrivalSeconds
Optional: tokenDecimals (default 6), tokenSymbol, tokenPriceUsd, externalId
→ returns { id, status: "awaiting_signature", ... }

### 2. Prepare
POST /transfers/{id}/prepare
→ returns { transfer, preparedTxs: {
    routeInitTxs[]: { base64 },
    orchestratorInitTx: string,
    sessionInitTxs[]: string,
    keeperFundingTx: string,
    recentBlockhash, lastValidBlockHeight
  }}

Sign each group with the sourceOwner keypair (see signing rules).

BROADCAST ORDER (strict): keeperFundingTx FIRST, then routeInitTxs, then orchestratorInitTx,
then sessionInitTxs.
null fields are already confirmed on-chain — skip them.

### 3. Confirm broadcast — call TWICE

First call (immediately after keeperFundingTx, before anything else):
POST /transfers/{id}/confirm-broadcast
{ routeInitSignatures: [], keeperFundingSignature: "..." }

Second call (after all remaining txs are broadcast and confirmed):
POST /transfers/{id}/confirm-broadcast
{ routeInitSignatures[], orchestratorInitSignature?, sessionInitSignatures?, keeperFundingSignature? }

keeperFundingSignature is REQUIRED if /prepare emitted a keeperFundingTx. Returns MH_039 if missing.
The two-call pattern prevents double-funding the keeper on resume.

Blockhashes expire ~60 seconds after /prepare. Call /prepare again with a new Idempotency-Key on
expiry; null fields will reflect what is already on-chain.

All POST mutations require an Idempotency-Key header (MH_070 if missing or invalid).

## Signing rules
- keeperFundingTx, routeInitTxs, sessionInitTxs → VersionedTransaction (v0)
  Add your signature to the correct slot in the existing signatures array.
  Do NOT call sign() or replace all signatures — server has pre-signed ephemeral keys.
- orchestratorInitTx → Legacy Transaction, use partialSign.
- Wait for each group to reach "confirmed" before broadcasting the next.
- Add 3s delay after last routeInitTx and after orchestratorInitTx.

## Polling transfer status
GET /transfers/{id}
→ { status, phase, progress: { hopsCompleted, hopsTotal }, lastError, recovery }

status: quote → awaiting_signature → processing → completed | failed | expired | refunded
phase:  quoted → deploying → executing → settled
        (failure: failed | recoverable | rescued | reclaimed | expired)

If phase = "recoverable" (funds locked on-chain):
  POST /transfers/{id}/rescue/prepare → sign txs → POST /transfers/{id}/rescue/confirm

## Compliance (mainnet)
- Routes are screened automatically by the keeper after deploy — no agent action needed.
- A flat screening fee (currently ~0.002 SOL on mainnet, configured/subject to change) is taken at
  deploy by the /prepare bundle, NOT in /estimate. Budget for it or the deploy can fail for
  insufficient lamports. It is a refundable deposit: clean route gets it back on verify, flagged
  route forfeits it.
- After the final confirm-broadcast the transfer sits in "processing" during the screening/verify
  window, then hops execute. Keep polling.
- A flagged wallet ends the transfer as "refunded": principal returned, screening deposit retained.

## Key constraints
- hops must be 3–10
- arrivalSeconds minimum varies by hop count (MH_014 if too low)
- externalId must be unique per integration key (MH_033 on duplicate)
- All POST mutations require Idempotency-Key header

## Common error codes
MH_001 / MH_002  invalid or revoked API key (401)
MH_012           amount below minimum (400)
MH_013           hops out of range — must be 3–10 (400)
MH_014           arrivalSeconds below minimum for hop count (400)
MH_032           funding not completed within timeout (408)
MH_033           duplicate externalId (409)
MH_034           transfer expired (410)
MH_039           keeperFundingSignature required but missing (400)
MH_070           Idempotency-Key header missing or invalid (400)
```

***

## MCP server integration

When building an MCP-compatible agent (Claude, LangGraph, AutoGen), expose the API steps as individual tools and keep `sign_and_broadcast` as a local tool that holds wallet access.

| Tool                 | Wraps                                          |
| -------------------- | ---------------------------------------------- |
| `estimate_transfer`  | `POST /api/v1/transfers/estimate`              |
| `create_transfer`    | `POST /api/v1/transfers`                       |
| `prepare_transfer`   | `POST /api/v1/transfers/:id/prepare`           |
| `sign_and_broadcast` | local — signs with keypair, broadcasts to RPC  |
| `confirm_broadcast`  | `POST /api/v1/transfers/:id/confirm-broadcast` |
| `get_transfer`       | `GET /api/v1/transfers/:id`                    |
| `list_transfers`     | `GET /api/v1/transfers`                        |
| `prepare_rescue`     | `POST /api/v1/transfers/:id/rescue/prepare`    |
| `confirm_rescue`     | `POST /api/v1/transfers/:id/rescue/confirm`    |

`sign_and_broadcast` is the only tool that requires wallet access. All other tools are pure HTTP wrappers and can be exposed without key material.

<Columns cols={2}>
  <Card title="API Reference" icon="terminal" href="/api-reference/introduction">
    Full endpoint documentation, error codes, and rate limits.
  </Card>

  <Card title="Webhooks" icon="bell" href="/api-reference/webhooks/events">
    Receive real-time transfer lifecycle events instead of polling.
  </Card>

  <Card title="Security model" icon="shield-halved" href="/concepts/security">
    Trust assumptions and on-chain guarantees.
  </Card>

  <Card title="Keeper network" icon="network-wired" href="/concepts/keepers">
    How keepers execute hops after broadcast.
  </Card>
</Columns>
