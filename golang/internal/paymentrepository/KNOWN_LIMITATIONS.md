# Known payment limitations

## Overlapping processing payments

Accepted for manual resolution by Ryan on 16 October 2026.

Checkout's deadline limits how long the customer can complete checkout. It does
not bound processing time after checkout completes. Preflight currently permits
a new checkout once the recorded deadline passes, even if the old payment is
still processing.

If a customer starts another checkout, both payments could be processing. A
subsequent failure of the older payment can revoke the account's provisional
license while the newer payment is still processing. Provisional entitlement is
tracked per account, without associating it with a particular attempt.

Ryan accepts this edge case for now. The intended card-only payment scope should
reduce its likelihood, and a customer who knows they submitted a payment is not
expected to initiate another while waiting. These are expectations, not enforced
invariants or a guarantee that card processing always finishes before the
checkout deadline. This note does not implement the card-only restriction.

If this occurs, inspect the account's Checkout Sessions and current payment
states in Stripe, identify the intended payment, and reconcile the account's
entitlement accordingly. Resolve any duplicate payment separately. Do not rely
on an expired checkout deadline as proof that a submitted payment failed.

The reproducer is preserved as a skipped test:
`TestOlderFailedAttemptDoesNotRevokeNewerProcessingCheckout` in
`Ordering_test.go`. Re-enable it if automatic handling of overlapping attempts
is implemented. This is an accepted limitation, not a passing test or a fix.

Payment-driven license events now carry session IDs, and terminal-event replay
clears only matching checkout info. Provisional entitlement is still projected
per account; this cleanup does not resolve the overlapping-payment revocation
limitation above.
