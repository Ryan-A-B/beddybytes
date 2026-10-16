# Payment command handler test list

Maintain this list as tests are added and run. Checked items have passing tests;
unchecked items are untested unless explicitly marked FAILING, POLICY PENDING,
or ACCEPTED LIMITATION (a skipped reproducer, not a passing test).
Work on one test at a time. Fix missing event replay handling and continue;
stop at the first other breaking case. Use the fake
checkout session repository; do not call Stripe.

## Account and license replay

- [x] V2 account starts trial. (`TestV2AccountCreationReplaySetsTrialLicense`)
- [x] V1 accounts are not projected or allowed to create checkout. (`TestStartCheckoutSessionRejectsV1Account`)
- [x] Unknown account cannot start checkout. (`TestStartCheckoutSessionRejectsUnknownAccount`)
- [x] Perpetual account cannot start another purchase. (`TestStartCheckoutSessionRejectsPerpetualAccount`)
- [x] License grants and revocations rebuild the correct state after restart. (`TestRestartAfterPaidSyncDoesNotGrantTwice`, `TestRestartReplaysProvisionalGrantPreservingTrialStart`, `TestRestartReplaysProvisionalRevocationRestoringTrialStart`)
- [x] Paid sync for an existing trial account appends a perpetual-license grant. (`TestSyncCheckoutSessionPaidSessionGrantsPerpetualLicense`)

## Creating checkout

- [x] Create receives the requested account ID; the started event uses that account and identifies the returned session. (`TestStartCheckoutSessionUsesSameAccountForCreateAndEvent`, using the fake repository)
- [x] Stripe Create sends client_reference_id equal to its account ID argument. (`internal/checkoutsessions/Stripe_test.go`: `TestCreateSetsClientReferenceIDToAccountID`, using an in-memory HTTP transport)

- [x] Concurrent starts for the same account share one create call and return the same session. (`TestStartCheckoutSessionConcurrentRequestsShareCreate`)
- [x] Different accounts can create concurrently. (`TestDifferentAccountsCanCreateConcurrently`)
- [x] An existing, unexpired session is reused. (`TestStartCheckoutSessionReusesOnlyUnexpiredSession`)
- [x] An expired session permits a new create. (`TestStartCheckoutSessionReusesOnlyUnexpiredSession`)
- [x] Create failure reaches all waiting callers; a subsequent request can retry. (`TestCreateFailureReachesWaitersAndAllowsRetry`)
- [x] A caller waiting on a shared Create can cancel independently, returning context.Canceled while the leader continues. (`TestStartCheckoutSessionWaitingCallerCanCancel`)
- [x] Event-append failure reaches all waiting callers without leaving them blocked; a subsequent request can retry. (`TestAppendFailureReachesWaitersAndAllowsRetry`)
- [x] No caller receives success before the started event is persisted. (`TestCheckoutSuccessWaitsForStartedEventPersistence`)
- [x] Replaying the started event allows reuse without another create. (`TestRestartReusesPersistedCheckout`)

## Syncing checkout

- [x] Only one retrieval is in flight for the same session; an open result emits no license event. (`TestSyncCheckoutSessionOnlyOneRetrieveInFlight`)
- [ ] Different sessions can sync concurrently.
- [ ] Retrieval failure clears the in-flight marker so retry works.
- [x] Completed/unpaid grants or retains provisional access only when the expanded PaymentIntent is processing; other statuses revoke it and preserve the original trial. (`TestFulfillCheckoutPaymentIntentStates`)
- [x] Missing or unexpanded PaymentIntent returns an error without changing access. (`TestFulfillCheckoutPaymentIntentStates`)
- [x] Stripe Retrieve requests payment_intent expansion. (`internal/checkoutsessions/Stripe_test.go`: `TestRetrieveExpandsPaymentIntent`)
- [x] Repeated sync of a paid session grants perpetual access only once. (`TestSyncCheckoutSessionRepeatedPaidResultGrantsLicenseOnce`)
- [x] An expired session emits no license change; it cannot transition from completed and must not revoke access associated with another checkout. (`TestFulfillCheckoutPaymentIntentStates`, expired-session subtests)
- [x] Nil sessions and unexpected session/payment statuses return an error without appending license events. (`TestFulfillCheckoutRejectsInvalidSessionWithoutEvents`)

## Restart recovery

Use a fresh command handler with the same durable event log. Never copy maps or
futures from the old instance. In-flight coordination is per process; it is not
a durable lock or a guarantee against duplicate Stripe sessions after a crash.

- [x] After a persisted checkout start, a fresh handler rebuilds eligibility and reuses the unexpired session without Create. (`TestRestartReusesPersistedCheckout`)
- [x] If Create was in flight with no started event persisted, a fresh handler starts a new Create rather than waiting on the old future. (`TestRestartStartsNewCreateWhenOldCreateWasNotPersisted`)
- [ ] If Stripe creation succeeded but the started event was not persisted, a fresh handler starts a new Create; the orphan Stripe session is not recoverable from this log.
- [x] If sync was in flight, a fresh handler starts a new Retrieve rather than inheriting syncInProgress. (`TestRestartStartsNewSyncWhenOldSyncIsInFlight`)
- [x] After a completed paid sync, a fresh handler rebuilds ineligibility; another sync can retrieve but must not append a duplicate perpetual grant. (`TestRestartAfterPaidSyncDoesNotGrantTwice`)
- [ ] After an open sync that emitted no license event, a fresh handler retrieves again.
- [ ] After provisional grant/revocation syncs, a fresh handler restores the appropriate license and original trial dates.

## Webhook and sync ordering

- [ ] ACCEPTED LIMITATION: Failure of an older payment may revoke provisional access while a newer checkout is processing. Manually resolve if it occurs. (`TestOlderFailedAttemptDoesNotRevokeNewerProcessingCheckout`, skipped; see [known limitation](KNOWN_LIMITATIONS.md#overlapping-processing-payments))

- [x] Polling retrieves a failed PaymentIntent and revokes provisional access without receiving a failure webhook. (`TestSyncFailedPaymentIntentRevokesProvisionalLicense`)
- [x] A webhook triggers retrieval and uses current PaymentIntent state rather than its older failure snapshot. (`TestWebhookReconcilesCurrentStateInsteadOfFailureSnapshot`)

- [ ] Repeated delivery of the same webhook produces no duplicate license change.
- [ ] Concurrent webhook and sync results produce one effective transition.
- [ ] FAILING: Paid webhook arrives while sync holds an older unpaid result: account must become perpetual. (`TestPaidWebhookDuringOlderUnpaidSyncGrantsPerpetualLicense`)
- [ ] Paid webhook arrives while sync holds an older expired result: account remains perpetual.
- [ ] Sync confirms payment before an older unpaid or expired webhook arrives: account remains perpetual.
- [ ] Account or license events appended during retrieval are caught up before applying its result.
- [ ] Failure or expiry of an older attempt cannot revoke entitlement from a newer successful attempt.

The earlier webhook-before-checkout-started case is removed: this flow only
releases the Checkout URL after the started event is persisted, so the customer
cannot complete that checkout before persistence. Test that persistence boundary
under Creating checkout instead.

## Errors and identity

- [x] The concrete StripeRepository satisfies the Repository interface accepted by the command handler. (`internal/checkoutsessions/Stripe_test.go`, interface assertion)

- [ ] Invalid webhook signature or malformed JSON changes nothing.
- [x] A verified webhook whose Checkout Session data is JSON null returns an error without panicking or appending events. (`TestRecordCheckoutSessionEventRejectsNullCheckoutPayload`)
- [ ] Unrelated webhook types are ignored.
- [x] Fulfillment errors propagate to the HTTP caller so Stripe can retry. (`TestRecordCheckoutSessionEventReturnsFulfillmentError`)
- [ ] Persistence failure leaves a retryable operation; replay and retry converge on the correct state.

## Current status

16 October 2026: added passing append-failure and persistence-boundary tests.
Both pass with -race, along with the existing shared Create failure test whose
setup is now shared with the append-failure test.

Stopped at `TestPaidWebhookDuringOlderUnpaidSyncGrantsPerpetualLicense`.
The initial Retrieve holds an older complete/unpaid/processing snapshot. A paid
webhook arrives before it returns. Its sync preflight sees syncInProgress and
returns success without retrieving current state or scheduling reconciliation.
The initial sync then grants provisional access. Both calls return nil, but only
one Retrieve occurred and no perpetual grant was persisted. This is one checkout
session, separate from the accepted overlapping-payment limitation.

The failing reproducer is retained; no implementation fix was made. The human's
uncommitted command handler edit remains unchanged.
