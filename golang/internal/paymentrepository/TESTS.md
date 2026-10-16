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

- [x] Create receives the requested account ID; the started event uses that account and identifies the returned session. (`TestStartCheckoutSessionUsesSameAccountForCreateAndEvent`, using the fake repository)
- [x] Stripe Create sends client_reference_id equal to its account ID argument. (`internal/checkoutsessions/Stripe_test.go`: `TestCreateSetsClientReferenceIDToAccountID`, using an in-memory HTTP transport)

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

16 October 2026: split account-agreement coverage along the repository boundary.
The command handler test uses the fake checkout repository to verify the account
passed to Create matches the started event and returned session. The Stripe
adapter test lives beside `Stripe.go` and verifies outgoing client_reference_id
with an in-memory HTTP transport. No live Stripe or network requests occur.

All ten command handler tests and the Stripe adapter test pass. No production
code changed and no defensive sync check was added. No further checklist cases
attempted during this change.
