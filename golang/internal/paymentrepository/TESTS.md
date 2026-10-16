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
- [ ] FAILING: A caller waiting on a shared Create can cancel independently, returning context.Canceled while the leader continues. (`TestStartCheckoutSessionWaitingCallerCanCancel`)
- [ ] Event-append failure reaches all waiting callers without leaving them blocked.
- [ ] No caller receives success before the started event is persisted.
- [x] Replaying the started event allows reuse without another create. (`TestRestartReusesPersistedCheckout`)

## Syncing checkout

- [x] Only one retrieval is in flight for the same session; an open result emits no license event. (`TestSyncCheckoutSessionOnlyOneRetrieveInFlight`)
- [ ] Different sessions can sync concurrently.
- [ ] Retrieval failure clears the in-flight marker so retry works.
- [ ] A completed, unpaid session follows the agreed pending/provisional policy. POLICY PENDING: the handler currently grants provisional access; confirm desired policy before testing that transition.
- [x] Repeated sync of a paid session grants perpetual access only once. (`TestSyncCheckoutSessionRepeatedPaidResultGrantsLicenseOnce`)
- [ ] An expired session revokes provisional access while preserving original trial dates. POLICY PENDING: depends on provisional-access policy.
- [ ] Unexpected statuses return an error without changing entitlement.

## Restart recovery

Use a fresh command handler with the same durable event log. Never copy maps or
futures from the old instance. In-flight coordination is per process; it is not
a durable lock or a guarantee against duplicate Stripe sessions after a crash.

- [x] After a persisted checkout start, a fresh handler rebuilds eligibility and reuses the unexpired session without Create. (`TestRestartReusesPersistedCheckout`)
- [x] If Create was in flight with no started event persisted, a fresh handler starts a new Create rather than waiting on the old future. (`TestRestartStartsNewCreateWhenOldCreateWasNotPersisted`)
- [ ] If Stripe creation succeeded but the started event was not persisted, a fresh handler starts a new Create; the orphan Stripe session is not recoverable from this log.
- [x] If sync was in flight, a fresh handler starts a new Retrieve rather than inheriting syncInProgress. (`TestRestartStartsNewSyncWhenOldSyncIsInFlight`)
- [ ] After a completed paid sync, a fresh handler rebuilds ineligibility; another sync can retrieve but must not append a duplicate perpetual grant.
- [ ] After an open sync that emitted no license event, a fresh handler retrieves again.
- [ ] After provisional grant/revocation syncs, a fresh handler restores the appropriate license and original trial dates. POLICY PENDING for the provisional-access transitions.

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

16 October 2026: added restart-recovery cases to distinguish ephemeral futures
and sync markers from projections rebuilt from the log. Added and individually
ran three passing tests: persisted checkout reuse after restart, new creation
when an old create is in flight without a started event, and new retrieval when
an old sync is in flight. Each uses a fresh handler without copying old state.

The next test, `TestStartCheckoutSessionWaitingCallerCanCancel`, fails: a waiting
caller's context is cancelled while the shared Create remains blocked. The
waiter stays blocked until Create finishes, then returns success rather than
context.Canceled. The shared future's Result wait does not observe the waiting
caller's context. Stopped here without changing implementation or running
further cases. Existing uncommitted command handler refactoring was preserved.
