# Payment HTTP handlers

`payments` owns HTTP parsing, authenticated account extraction, responses and
redirects. Its `Commands` interface is implemented by
`paymentrepository.CommandHandler`. Stripe calls, signature verification,
fulfillment and durable events stay in the payment repository.

| Route | Behavior |
| --- | --- |
| `POST /payment/start` | Authenticate, start or reuse Checkout for that account, then redirect to the returned Checkout URL with 303. |
| `GET /payment/stripe/success?session_id=...` | Sync the session through the repository, then redirect to the configured frontend with `payment_status=pending`. |
| `GET /payment/stripe/cancel` | Redirect to the configured frontend with `payment_status=cancelled`. No repository mutation. |
| `POST /payment/stripe/webhook` | Pass the raw body and `Stripe-Signature` to `RecordCheckoutSessionEvent`; acknowledge only after the command succeeds. |

Start accepts the existing authorization middleware's Bearer header or browser
form `access_token`. The account ID comes from the verified token. Submit a
browser form to navigate to Checkout; a fetch redirect does not navigate the
page. An ineligible account receives 403. Other start/sync command failures
receive 500 and do not redirect.

A success callback is browser navigation, not proof of payment. Sync currently
returns only an error, so `pending` means the frontend must read the account's
license to determine access, including when payment has already succeeded.
Cancellation does not expire the session or revoke a license; the current
repository has no browser-cancellation command.

Webhook bodies are limited to 1 MiB. Missing signatures and unreadable bodies
receive 400; oversized bodies receive 413. Command errors receive 500, including
verification errors, because the command currently does not distinguish webhook
validation failures from persistence failures. This preserves retries when
processing cannot complete. This controller never retrieves a session for a
webhook; the repository fulfills the delivered session directly.

Configure the Stripe repository's callback URLs as:

- Success: `https://api.example.com/payment/stripe/success?session_id={CHECKOUT_SESSION_ID}`
- Cancel: `https://api.example.com/payment/stripe/cancel`

Register the handlers with an existing command handler and a fixed frontend URL:

```go
paymentHandlers := &payments.Handlers{
    Commands:    paymentCommandHandler,
    Key:         key,
    FrontendURL: "https://app.example.com/payment/result",
}
paymentHandlers.AddRoutes(router.NewRoute().Subrouter())
```

The backend startup does not yet construct or register payment services. This
package supplies the routes for that wiring; configuration of Stripe keys,
webhook secrets, prices and callback URLs belongs with repository construction.

Tests use fake commands and an in-process HTTP router; no Stripe requests run.
