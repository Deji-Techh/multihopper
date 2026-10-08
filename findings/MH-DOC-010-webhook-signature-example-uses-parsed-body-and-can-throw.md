# MH-DOC-010: Webhook signature verification example hashes parsed `req.body` and can throw on malformed signatures

Severity: Documentation blocker

## Summary

The Webhook Events documentation shows an HMAC verification helper, but the example handler passes `req.body` directly into `verifyWebhook`. In common Node/Express/Fastify setups, `req.body` is already parsed JSON, not the original raw request bytes. HMAC verification must use the exact raw request body bytes/string that MultiHopper signed. The sample also calls `crypto.timingSafeEqual` without checking buffer lengths, so malformed or missing signatures can throw instead of returning `false`.

## What I Built Or Used

- Official docs snapshot fetched from `https://dev-docs.multihopper.com`.
- Local Node.js crypto reproduction.
- No API mutation, no signing, and no Solana broadcast.

## Affected Flow

- Webhook-based monitoring.
- Agentic transfer status and recovery handling through webhook events.
- Any integration copied from `api-reference/webhooks/events.md`.

## Steps To Reproduce

1. Open `reports/private/docs/api-reference/webhooks/events.md`.
2. Copy the documented `verifyWebhook(payload, signature, secret)` helper.
3. Call it with:
   - the raw JSON string and a valid HMAC signature,
   - a parsed JSON object as `payload`,
   - a short malformed signature.
4. Observe that the raw string succeeds, but the parsed object and malformed signature throw.

## Evidence

Docs excerpt behavior:

```javascript
function verifyWebhook(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

const signature = req.headers['x-multihopper-signature'];
const isValid = verifyWebhook(req.body, signature, whsec_secret);
```

Local reproduction:

```bash
node -e "const crypto=require('crypto'); function verifyWebhook(payload, signature, secret){const expected=crypto.createHmac('sha256', secret).update(payload).digest('hex'); return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));} const raw='{\"event\":\"transfer.completed\"}'; const secret='whsec_test'; const sig=crypto.createHmac('sha256', secret).update(raw).digest('hex'); console.log('raw ok', verifyWebhook(raw, sig, secret)); try { console.log('object body', verifyWebhook(JSON.parse(raw), sig, secret)); } catch (e) { console.log('object body throws', e.code || e.name); } try { console.log('short sig', verifyWebhook(raw, 'bad', secret)); } catch (e) { console.log('short sig throws', e.code || e.name); }"
```

Output:

```text
raw ok true
object body throws ERR_INVALID_ARG_TYPE
short sig throws ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH
```

## Expected Result

The docs should show a webhook verification example that:

- uses the exact raw request body bytes/string,
- handles missing or malformed signatures by returning `false`,
- compares equal-length buffers only,
- avoids throwing in the normal unauthenticated-request path.

## Actual Result

The documented example passes `req.body`, which is often parsed JSON, and the helper can throw on normal invalid-signature inputs.

## Impact

Agent impact:

- Agents relying on webhook monitoring may reject valid MultiHopper webhook events if their framework parses JSON before verification.
- Malformed or missing signatures can crash a naive webhook handler copied from the docs.
- If webhook delivery fails, agents lose phase/status/recovery events and fall back to polling, weakening automated recovery.

Security impact:

- Webhook signature verification is security-critical copy-paste code.
- A broken verifier can lead teams to disable verification during debugging or mishandle invalid requests.

## Proposed Fix

Document raw-body verification explicitly. Example:

```javascript
const crypto = require("crypto");

function verifyWebhook(rawBody, signature, secret) {
  if (typeof signature !== "string") return false;

  const expectedHex = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  const actual = Buffer.from(signature, "hex");
  const expected = Buffer.from(expectedHex, "hex");
  if (actual.length !== expected.length) return false;

  return crypto.timingSafeEqual(actual, expected);
}
```

Also add framework-specific notes for Express/Fastify/Next.js showing how to capture the raw request body before JSON parsing.

## Contact

TBD
