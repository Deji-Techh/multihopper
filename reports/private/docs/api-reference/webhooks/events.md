> ## Documentation Index
> Fetch the complete documentation index at: https://dev-docs.multihopper.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Webhook Events

> Verify signatures and handle transfer lifecycle events

## Signature verification

Webhook payloads are signed with HMAC-SHA256 using your endpoint secret. Always verify the signature before processing a payload.

```javascript theme={null}
const crypto = require('crypto');

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

// In your handler:
const signature = req.headers['x-multihopper-signature'];
const isValid = verifyWebhook(req.body, signature, whsec_secret);
```

## Event types

| Event                        | Description                                                                |
| ---------------------------- | -------------------------------------------------------------------------- |
| `transfer.quote_created`     | A transfer has been created and quoted                                     |
| `transfer.deposit_confirmed` | Funding transactions have been confirmed                                   |
| `transfer.processing`        | Transfer is actively being processed                                       |
| `transfer.phase_changed`     | Transfer moved to a new execution phase                                    |
| `transfer.hop_complete`      | An intermediate hop has completed                                          |
| `transfer.completed`         | Transfer has arrived at the recipient                                      |
| `transfer.failed`            | Transfer failed                                                            |
| `transfer.expired`           | Transfer expired before funding was completed                              |
| `transfer.refunded`          | Transfer was refunded                                                      |
| `transfer.recoverable`       | Transfer failed with funds locked in on-chain accounts that can be rescued |
| `transfer.rescued`           | Locked funds were successfully recovered to the sender                     |
| `transfer.rent_reclaimed`    | Closed on-chain step accounts; rent returned to sender                     |
| `payout.completed`           | An integrator reward claim has settled                                     |

## Retry schedule

If your endpoint fails to return a `2xx` response, the event is retried on the following schedule:

| Attempt | Delay      | Cumulative |
| ------- | ---------- | ---------- |
| 1       | Immediate  | 0s         |
| 2       | 30 seconds | 30s        |
| 3       | 5 minutes  | 5m 30s     |
| 4       | 30 minutes | 35m 30s    |
| 5       | 2 hours    | 2h 35m     |

After 5 failed attempts, the delivery is marked as permanently failed.
