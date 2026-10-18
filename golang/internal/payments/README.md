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

Set `FrontendURL` to the app's `/payments/callback` route. A completed, paid
session returns without an `error` parameter. Other returns use these codes:

- `payment_cancelled`: the browser left Checkout.
- `payment_failed`: the retrieved checkout is not paid or processing.
- `payment_pending`: payment is processing, or another sync is in flight.
- `temporarily_unavailable`: retrieval, validation or persistence failed.
- `invalid_request`: the callback has no session ID.

The callback displays a single Payment Successful or Payment Failed heading and
an account link. It does not change access, refresh tokens or poll. The account
page fetches on entry and when Refresh is clicked. Licenses are display data;
`/accounts/current` supplies trial `end_unix_seconds` as start plus seven days.

`SyncCheckoutSessionWithResult` reports paid/processing only after fulfillment
succeeds. Existing callers that only need reconciliation can continue using
`SyncCheckoutSession`. Webhooks fulfill their delivered session directly and
never enter sync coordination. Browser cancellation leaves checkout reusable.

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

Tests use fake repositories/commands; no live Stripe requests run.

Local sandbox webhooks can use the persistent `stripe-cli` Compose service.
See [local listener setup](../../../scripts/stripe/README.md). The public proxy
`https://api.local.beddybytes.com` supports browser redirects; webhook delivery
uses the CLI's internal Docker connection instead.
