# Payment HTTP handlers

`payments` owns HTTP parsing, authenticated account extraction, responses and
redirects. Its `Commands` interface is implemented by
`paymentrepository.CommandHandler`. Stripe calls, signature verification,
fulfillment and durable events stay in the payment repository.

| Route | Behavior |
| --- | --- |
| `POST /payments/start` | Authenticate, start or reuse Checkout for that account, then redirect to its URL with 303. |
| `GET /payments/stripe/success?session_id=...` | Sync and fulfill the session, then redirect to the frontend callback with its outcome. |
| `GET /payments/stripe/cancel` | Redirect to the frontend callback with `error=payment_cancelled`. No repository mutation. |
| `POST /payments/stripe/webhook` | Pass the raw body and `Stripe-Signature` to `RecordCheckoutSessionEvent`; acknowledge only after the command succeeds. |

Start accepts the existing authorization middleware's Bearer header or browser
form `access_token`. The account ID comes from the verified token. The account
page submits an ordinary browser form POST to navigate to Checkout. An ineligible
account receives 403. Other start command failures receive 500.

Set `FrontendURL` to the app's `/payments/callback` route. After an error-free
`SyncCheckoutSession`, the browser redirects without an `error` parameter. Unpaid
or processing is a valid reconciled state, not a command error; later verified
webhook notifications retrieve current Stripe state and resolve the license.
Retrieval, validation and persistence failures use `temporarily_unavailable`, a
missing session ID uses `invalid_request`, and browser cancellation uses
`payment_cancelled`. The frontend still understands older pending/failed result
codes, but successful sync does not produce them.

The callback displays a single Payment Successful or Payment Failed heading and
an account link. It does not change access, refresh tokens or poll. The account
page fetches on entry and when Refresh is clicked. Licenses are display data;
`/accounts/current` supplies trial `trial_detail.end_unix_seconds` as start plus seven days.

`SyncCheckoutSession` returns only an error. Verified thin webhooks and browser
success both request the same per-session sync. `CoalescingSyncQueue` holds
current/next futures: a request during the current pass creates or shares the
next future. Its runner waits for the current pass, promotes next to current,
clears next under the command-handler mutex, then retrieves and fulfills. Requests
during that new pass can schedule another pass. Callers share each queued pass's
result, including persistence errors; an earlier failed pass does not prevent
the next one running. Queue entries are retained between requests.

Sync execution uses background contexts, and callers wait for their future.
Caller cancellation, per-pass timeouts and service shutdown wiring are outside
the current scope. Different Checkout Sessions can sync concurrently. Browser
cancellation leaves checkout reusable.

Webhook bodies are limited to 1 MiB. Missing signatures and unreadable bodies
receive 400; oversized bodies receive 413. Command errors receive 500, including
verification errors, because the command currently does not distinguish webhook
validation failures from persistence failures. Processing failures remain
retryable.

Configure the Stripe repository's callback URLs as:

- Success: `https://api.example.com/payments/stripe/success?session_id={CHECKOUT_SESSION_ID}`
- Cancel: `https://api.example.com/payments/stripe/cancel`

Register the handlers with an existing command handler and a fixed frontend URL:

```go
paymentHandlers := &payments.Handlers{
    Commands:    paymentCommandHandler,
    Key:         key,
    FrontendURL: "https://app.example.com/payments/callback",
}
paymentHandlers.AddRoutes(router.NewRoute().Subrouter())
```

Backend startup requires `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`STRIPE_PERPETUAL_PRICE_ID`, `API_ORIGIN` and `FRONTEND_PAYMENT_CALLBACK_URL`.
Missing required configuration is fatal. Success/cancel URLs are derived from
`API_ORIGIN`. Local Compose passes these variables through and
sets the callback to `https://app.beddybytes.local/payments/callback`.

Configure the Stripe destination as **Thin**, subscribing to
`v1.checkout.session.completed`, `v1.checkout.session.expired`,
`v1.checkout.session.async_payment_succeeded` and
`v1.checkout.session.async_payment_failed`. The SDK verifies the raw notification
and extracts its related Checkout Session ID; state comes from a fresh retrieval
with `payment_intent` expanded. Snapshot payloads are rejected. Reconfigure the
destination/listener and its signing secret together with this backend change.

Tests include signed thin payloads through HTTP, the real Stripe adapter and a
local event log, using an in-memory Stripe HTTP transport. No live Stripe requests
run.

Local sandbox webhooks can use the persistent `stripe-cli` Compose service.
See [local listener setup](../../../scripts/stripe/README.md). The public proxy
`https://api.local.beddybytes.com` supports browser redirects; webhook delivery
uses the CLI's internal Docker connection instead.
