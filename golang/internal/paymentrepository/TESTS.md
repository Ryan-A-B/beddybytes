# Payment command handler test list

## 19 October 2026 review status

The error-only `SyncCheckoutSession` and `future` → `syncx` migration compile
through backend constructors, HTTP stubs and tests. Payment-state assertions use
projected licenses rather than the removed result type. Queue tests invoke the
public command. Ryan fixed promotion of `next` to `current` and clearing `next`
before retrieval, allowing requests during every pass to schedule another pass.

Unpaid/processing sync is intentionally successful and may resolve through a later
notification. Signed HTTP coverage verifies provisional/trial state followed by
a paid notification granting perpetual access. Request cancellation and sync
execution deadlines are explicitly outside scope; tests no longer require them.

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

- [x] Concurrent starts for the same account share the complete operation future, perform one preflight/create and return the same output object. (`TestStartCheckoutSessionConcurrentRequestsShareCreate`)
- [x] Different accounts can create concurrently. (`TestDifferentAccountsCanCreateConcurrently`)
- [x] An existing, unexpired session is reused. (`TestStartCheckoutSessionReusesOnlyUnexpiredSession`)
- [x] An expired session permits a new create. (`TestStartCheckoutSessionReusesOnlyUnexpiredSession`)
- [x] Create failure reaches all waiting callers; a subsequent request can retry. (`TestCreateFailureReachesWaitersAndAllowsRetry`)
- [x] A caller waiting on a shared Create can cancel independently, returning context.Canceled while the leader continues. (`TestStartCheckoutSessionWaitingCallerCanCancel`)
- [x] Event-append failure reaches all waiting callers without leaving them blocked; a subsequent request can retry. (`TestAppendFailureReachesWaitersAndAllowsRetry`)
- [x] No caller receives success before the started event is persisted. (`TestCheckoutSuccessWaitsForStartedEventPersistence`)
- [x] Replaying the started event allows reuse without another create. (`TestRestartReusesPersistedCheckout`)

- [x] Payment-driven license grants/revocation carry their checkout session ID. (`TestCompletedCheckoutSessionInfoLifecycle`)
- [x] Completed unsuccessful checkout without provisional access emits a checkout-ended event and leaves the original trial unchanged. (`TestCompletedCheckoutSessionInfoLifecycle`)
- [x] Perpetual grant/provisional revocation/checkout-ended replay removes matching session info, allowing a fresh checkout after failure even before the old expiry; provisional grant retains its reference. (`TestCompletedCheckoutSessionInfoLifecycle`, same/fresh handlers)
- [x] Older terminal events do not remove a newer checkout's session info. (`TestOldCheckoutEndDoesNotRemoveNewSessionInfo`)
- [x] Checkout-ended persistence failure propagates, preserves pending info, and can be retried durably. (`TestCheckoutEndedPersistenceFailureCanRetry`)
- [x] Revoking a non-provisional license returns an error without appending events; ending checkout separately ignores older or already-ended sessions. (`TestRevokeNonProvisionalLicenseLeavesCheckoutForCallerToEnd`)

## Syncing checkout

- [x] One retrieve-and-fulfill pass runs per session; arrivals during each pass coalesce into a fresh follow-up pass. (`TestSyncQueueRetrievesAgainForRequestsDuringEveryPass`)
- [x] Different sessions can sync concurrently. (`TestDifferentSessionsCanSyncConcurrently`)
- [x] Retrieval failure does not poison subsequent sync requests. (`TestRetrieveFailureAllowsSyncRetry`)
- [x] Completed/unpaid grants or retains provisional access only when the expanded PaymentIntent is processing; other statuses revoke it and preserve the original trial. (`TestFulfillCheckoutPaymentIntentStates`)
- [x] Missing or unexpanded PaymentIntent returns an error without changing access. (`TestFulfillCheckoutPaymentIntentStates`)
- [x] Stripe Retrieve requests payment_intent expansion. (`internal/checkoutsessions/Stripe_test.go`: `TestRetrieveExpandsPaymentIntent`)
- [x] Repeated sync of a paid session grants perpetual access only once. (`TestSyncCheckoutSessionRepeatedPaidResultGrantsLicenseOnce`)
- [x] An expired session emits no license change; it cannot transition from completed and must not revoke access associated with another checkout. (`TestFulfillCheckoutPaymentIntentStates`, expired-session subtests)
- [x] Nil sessions and unexpected session/payment statuses return an error without appending license events. (`TestFulfillCheckoutRejectsInvalidSessionWithoutEvents`)

- [x] Error-only sync applies paid, processing, failed, open and expired Stripe states to projected licenses. (`TestSyncAppliesStripePaymentState`)
- [x] Each concurrent caller waits for a fresh retrieval covering its request; outcomes reflect that pass rather than a fabricated Processing result. (`TestSyncQueueRetrievesAgainForRequestsDuringEveryPass`)
- [x] Retrieval/persistence failure reaches the current batch and does not discard queued work. (`TestSyncQueueRunsPendingPassAfterRetrievalOrPersistenceFailure`)
- [x] A webhook arriving during an active browser sync waits for its fresh pass and fulfillment. (`TestWebhookWaitsForFreshDurableSync`)
- [x] Unpaid browser sync succeeds, preserves provisional/trial access, and a later signed paid notification upgrades the license. (`payments/TestSuccessReturnAllowsUnpaidCheckoutToResolveLater`)
- [x] Three sequential requests retrieve three times; concurrent bursts continue after completed passes with at most one retrieval at a time. (`TestSequentialSyncRequestsAlwaysRetrieveFreshState`, `TestConcurrentSyncRequestsAcrossIdleTransitionsAllComplete`)

## Restart recovery

Use a fresh command handler with the same durable event log. Never copy maps or
futures from the old instance. In-flight coordination is per process; it is not
a durable lock or a guarantee against duplicate Stripe sessions after a crash.

- [x] After a persisted checkout start, a fresh handler rebuilds eligibility and reuses the unexpired session without Create. (`TestRestartReusesPersistedCheckout`)
- [x] If Create was in flight with no started event persisted, a fresh handler starts a new Create rather than waiting on the old future. (`TestRestartStartsNewCreateWhenOldCreateWasNotPersisted`)
- [x] If Stripe creation succeeded but the started event was not persisted, a fresh handler starts a new Create; the orphan Stripe session is not recoverable from this log. (`TestRestartCreatesAgainAfterStartedEventAppendFailure`)
- [x] If sync was in flight, a fresh handler starts a new Retrieve rather than inheriting syncInProgress. (`TestRestartStartsNewSyncWhenOldSyncIsInFlight`)
- [x] After a completed paid sync, a fresh handler rebuilds ineligibility; another sync can retrieve but must not append a duplicate perpetual grant. (`TestRestartAfterPaidSyncDoesNotGrantTwice`)
- [x] After an open sync that emitted no license event, a fresh handler retrieves again. (`TestRestartAfterOpenSyncRetrievesAgain`)
- [x] After provisional grant/revocation syncs, a fresh handler restores the appropriate license and original trial dates. (`TestRestartAfterProvisionalSyncsPreservesTrialDates`)

## Webhook and sync ordering

- [ ] ACCEPTED LIMITATION: Failure of an older payment may revoke provisional access while a newer checkout is processing. Manually resolve if it occurs. (`TestOlderFailedAttemptDoesNotRevokeNewerProcessingCheckout`, skipped; see [known limitation](KNOWN_LIMITATIONS.md#overlapping-processing-payments))

- [x] Polling retrieves a failed PaymentIntent and revokes provisional access without receiving a failure webhook. (`TestSyncFailedPaymentIntentRevokesProvisionalLicense`)
- [x] A verified thin notification triggers retrieval with PaymentIntent expansion; repeated/stale completion notifications use current state and do not resurrect failed provisional access. (`TestWebhookSyncsCurrentStateAndIgnoresStaleNotificationState`)
- [x] Webhook-only completion grants the license after persistence. A signed HTTP notification passes through the SDK parser, real Stripe adapter and durable event log; append failure returns HTTP 500 without granting access. (`payments/TestSignedThinWebhookRetrievesAndAcknowledgesOnlyAfterDurableFulfillment`)
- [x] Browser sync and webhook notifications share the same ordered queue; no webhook acknowledges an older in-flight retrieval. (`TestWebhookWaitsForFreshDurableSync`)
- [x] Account or license events appended during retrieval are caught up before applying its result. (`TestSyncCatchesUpEventsArrivingDuringRetrieve`)

The earlier webhook-before-checkout-started case is removed: this flow only
releases the Checkout URL after the started event is persisted, so the customer
cannot complete that checkout before persistence. Test that persistence boundary
under Creating checkout instead.

## Errors and identity

- [x] The concrete StripeRepository satisfies the Repository interface accepted by the command handler. (`internal/checkoutsessions/Stripe_test.go`, interface assertion)

- [x] Signed real thin payloads for all four Checkout event types parse. Tampering, invalid signatures, malformed JSON, snapshot payloads and invalid related objects are rejected. Unrelated events and destination pings are ignored. (`internal/checkoutsessions/TestParseNotificationVerifiesThinCheckoutEvents`, `TestParseNotificationRejectsMalformedOrSnapshotAndIgnoresUnrelated`)
- [x] Parse/retrieval failure does not grant a license; unrelated notifications do not retrieve. (`TestWebhookParsingAndRetrievalFailuresRemainRetryable`)
- [x] Fulfillment errors propagate to the HTTP caller so Stripe can retry. (`TestRecordCheckoutSessionEventReturnsFulfillmentError`)
- [x] Persistence failure leaves a retryable operation; replay and retry converge on the correct state. (`TestLicensePersistenceFailureConvergesOnRetry`, same/fresh handler, perpetual grant, provisional grant and revocation)

## Current status

19 October 2026: success callbacks and verified thin notifications both sync current
Stripe state through per-session current/next futures. Promotion now clears next
before each new retrieval, so follow-up requests never reuse a completed queued
result. The command returns error only; unpaid is a valid state that later Stripe
notifications can resolve. Future/promise utilities now live in `syncx`. Caller
cancellation and shared execution deadlines are outside the accepted scope.

The local CLI forwards the four `v1.checkout.session.*` thin notifications from
`@self`. QA destinations must use Thin with the corresponding signing secret.
These tests use signed fixtures and in-memory Stripe transport, not live delivery.
The accepted overlapping-payment reproducer remains skipped. Live QA notification
delivery and E06b are separate verification/work items.

## Full checkout-result future — 18 October 2026

`StartCheckoutSession` registers a future for `*StartCheckoutSessionOutput`
before validation/preflight. The leader resolves it once with the complete
operation's output/error and removes it on completion. Followers only select
between their context cancellation and that future, then return its result.
The old session-info future and special cached-result preflight output are gone.

Updated concurrency barriers observe the follower entering its future wait,
instead of expecting it to read the event log again. The shared-create test
asserts one preflight and pointer-identical output. Create/append error sharing,
retry, waiter cancellation, persistence-before-success and restart tests pass
with race detection, along with the future package tests.

## Checkout cleanup — 18 October 2026

Added `stripe_checkout_session.ended` with `session_id` for an outstanding
completed unsuccessful checkout when there is no provisional license to revoke.
Perpetual grant and provisional revocation also carry `session_id`; replay clears
only the matching session info. Provisional grant carries the ID but retains the
reference. A repeated terminal observation with no matching pending session emits
nothing. The new tests and existing payment/account/HTTP/backend tests pass with
race detection. Startup reconciliation itself is not part of this change.
