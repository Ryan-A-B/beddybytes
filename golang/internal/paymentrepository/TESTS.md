# Payment command handler test list

Maintain this list as tests are added and run. Checked items have passing tests;
unchecked items are untested unless explicitly marked FAILING or POLICY PENDING.
Work on one test at a time. Fix missing event replay handling and continue;
stop at the first other breaking case. Use the fake
checkout session repository; do not call Stripe.

## Account and license replay

- [x] V2 account starts trial. (`TestV2AccountCreationReplaySetsTrialLicense`)
- [x] V1 accounts are not projected or allowed to create checkout. (`TestStartCheckoutSessionRejectsV1Account`)
- [x] Unknown account cannot start checkout. (`TestStartCheckoutSessionRejectsUnknownAccount`)
- [x] Perpetual account cannot start another purchase. (`TestStartCheckoutSessionRejectsPerpetualAccount`)
- [ ] License grants and revocations rebuild the correct state after restart.
- [x] Paid sync for an existing trial account appends a perpetual-license grant. (`TestSyncCheckoutSessionPaidSessionGrantsPerpetualLicense`)

## Creating checkout

- [x] Stripe client_reference_id and the started event use the requested account ID and identify the returned session. (`TestStartCheckoutSessionUsesSameAccountForStripeAndEvent`)

- [x] Concurrent starts for the same account share one create call and return the same session. (`TestStartCheckoutSessionConcurrentRequestsShareCreate`)
- [ ] Different accounts can create concurrently.
- [ ] An existing, unexpired session is reused.
- [ ] An expired session permits a new create.
- [ ] Create failure reaches all waiting callers; a subsequent request can retry.
- [ ] Event-append failure reaches all waiting callers without leaving them blocked.
- [ ] No caller receives success before the started event is persisted.
- [ ] Replaying the started event allows reuse without another create.

## Syncing checkout

- [x] Only one retrieval is in flight for the same session; an open result emits no license event. (`TestSyncCheckoutSessionOnlyOneRetrieveInFlight`)
- [ ] Different sessions can sync concurrently.
- [ ] Retrieval failure clears the in-flight marker so retry works.
- [ ] A completed, unpaid session follows the agreed pending/provisional policy. POLICY PENDING: the handler currently grants provisional access; confirm desired policy before testing that transition.
- [x] Repeated sync of a paid session grants perpetual access only once. (`TestSyncCheckoutSessionRepeatedPaidResultGrantsLicenseOnce`)
- [ ] An expired session revokes provisional access while preserving original trial dates. POLICY PENDING: depends on provisional-access policy.
- [ ] Unexpected statuses return an error without changing entitlement.

## Webhook and sync ordering

- [ ] Repeated delivery of the same webhook produces no duplicate license change.
- [ ] Concurrent webhook and sync results produce one effective transition.
- [ ] Paid webhook arrives while sync holds an older unpaid result: account remains perpetual.
- [ ] Paid webhook arrives while sync holds an older expired result: account remains perpetual.
- [ ] Sync confirms payment before an older unpaid or expired webhook arrives: account remains perpetual.
- [ ] Account or license events appended during retrieval are caught up before applying its result.
- [ ] Failure or expiry of an older attempt cannot revoke entitlement from a newer successful attempt.

The earlier webhook-before-checkout-started case is removed: this flow only
releases the Checkout URL after the started event is persisted, so the customer
cannot complete that checkout before persistence. Test that persistence boundary
under Creating checkout instead.

## Errors and identity

- [ ] Invalid webhook signature or malformed payload changes nothing.
- [ ] Unrelated webhook types are ignored.
- [x] Fulfillment errors propagate to the HTTP caller so Stripe can retry. (`TestRecordCheckoutSessionEventReturnsFulfillmentError`)
- [ ] Persistence failure leaves a retryable operation; replay and retry converge on the correct state.

## Current status

16 October 2026: removed the artificial sync ownership-mismatch test. Stripe
client_reference_id and the started event originate from the same command input;
an inconsistent reference would be a creation defect. No defensive sync check
is required or added.

The replacement test runs the real Stripe Create adapter and SDK with an
in-memory HTTP transport, verifies the outgoing client_reference_id equals the
requested account ID, and checks the persisted started event has the same account
and returned session. No network or Stripe service is called.

All ten payment command handler tests pass, including the replacement test.
No further checklist cases attempted during this change.
