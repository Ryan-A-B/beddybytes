# Payment HTTP sketch

`Handlers.go` shows real Stripe Go SDK calls for creating and retrieving hosted
Checkout Sessions and verifying webhook signatures. It is intentionally not
registered in the backend yet. No Stripe requests run until the handlers are
configured and invoked.

The `Commands` interface is a proposed boundary, not an adapter already
implemented by `paymentrepository.CommandHandler`. Adjust it alongside that
repository's input/output models. The important sequence is:

1. Start a durable attempt and obtain its unguessable payment ID.
2. Create Stripe Checkout, with that ID as metadata and its idempotency key.
3. Record the Stripe Checkout ID before redirecting to Stripe.
4. Retrieve and verify Checkout on browser success or webhook notification.
5. Record success using the payment ID, account ID and Stripe references.

Cancellation carries the payment ID; the repository resolves the recorded account
and checkout. It records browser abandonment, not a terminal Stripe failure.
Success can follow cancellation, and cancellation after success is a no-op.

Example backend wiring once the command adapter exists:

```go
paymentHandlers := &payments.Handlers{
    Stripe:        stripe.NewClient(os.Getenv("STRIPE_SECRET_KEY")),
    Commands:      paymentCommandsAdapter,
    Key:           key,
    PriceID:       os.Getenv("STRIPE_PERPETUAL_PRICE_ID"),
    WebhookSecret: os.Getenv("STRIPE_WEBHOOK_SECRET"),
    APIBaseURL:    "https://api.example.com",
    FrontendURL:   "https://app.example.com/payment/result",
    LiveMode:      false, // true for live Stripe credentials
}
paymentHandlers.AddRoutes(router.NewRoute().Subrouter())
```

The frontend submits an ordinary browser form POST to `/payment/start` with an
`access_token` field. The backend responds with a 303 redirect to Stripe. A fetch
request following a redirect would not navigate the browser to Checkout.

Use a snapshot webhook destination with an API version matching the SDK. Handle
`checkout.session.completed` and `checkout.session.async_payment_succeeded`.
Only `payment_status=paid` grants access. The webhook acknowledges after the
repository command succeeds so failures remain retryable.

Remaining integration work includes account scope checks, configuration
validation, durable duplicate/concurrency handling, checkout-creation failure
and orphan reconciliation, and failed/expired attempts. The repository must
validate callback IDs against its own recorded attempt, allow fulfillment after
abandonment, and preserve enough history to do that after pending entries are
removed. This sketch does not change token scopes, licenses or the frontend.

References: [Checkout creation](https://docs.stripe.com/api/checkout/sessions/create),
[fulfillment](https://docs.stripe.com/checkout/fulfillment.md?payment-ui=stripe-hosted),
[webhooks](https://docs.stripe.com/webhooks).
