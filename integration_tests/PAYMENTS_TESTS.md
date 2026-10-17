# Account licenses and payments: Selenium end-to-end test list

Maintain this checklist as tests are implemented and run. An unchecked item is
not yet verified. Check an item only after its implemented test passes against
the configured local stack, and record the test name and evidence. A fixture or
infrastructure dependency is not a passing test. This document does not implement
or execute the tests.

Use the existing Python unittest/Selenium suite under `integration_tests/src/tests/`.
Suggested modules: `test_account_license.py` and `test_payments.py`. Work through
the core cases first, one test at a time; retain a failing test and investigate
before expanding coverage.

## Environment and test data

- Selenium Hub: `SELENIUM_HUB_URL`, default `http://localhost:4444`.
- Browser app: `https://app.beddybytes.local`.
- Account API: `API_BASE_URL`, default `https://api.beddybytes.local`.
- Browser payment returns: `https://api.local.beddybytes.com/payment/stripe/...`
  through the browser-accessible proxy, then the app's `/payment/callback`.
- Stripe webhook delivery: the running CLI listener forwards to
  `http://api:9000/payment/stripe/webhook`. It does not use the public proxy.
- Use the configured sandbox, its lifetime price, restricted API key and the
  CLI listener's signing secret. Never run the purchase cases against live mode.
- Use a fresh, uniquely named test account for each independent purchase case.
  Reuse accounts only within a single scenario. Do not depend on test order.
- Use Stripe's documented sandbox card data. Start Checkout through the app so
  the session is bound to the account; standalone `stripe trigger` fixtures do
  not establish an account-bound purchase.
- Use explicit WebDriver waits for navigation, UI state and eventual webhook
  fulfillment. The existing account tests' one-second waits are too short for
  hosted payment flows. Use bounded, configurable timeouts rather than sleeps.
- Fix the browser time zone for deterministic date assertions. Compare `<time
  datetime>` values with backend timestamps, as well as checking visible dates.
- Selenium may poll the account API as a test observer while awaiting webhooks;
  the account page itself must refresh only on entry or a Refresh click.
- Browser screenshots, failure URLs with tokens redacted, and response/error
  codes are useful failure evidence. Keep API keys, tokens and signing secrets
  out of test artifacts.

## Core browser flows — implement first

- [ ] **E01 — Signup to trial account page.** Create an account through the UI,
  use the Account navbar link, and verify the Account heading, Trial license,
  Started and Ends values, Refresh button and Buy lifetime access button. Match
  both timestamps to `/accounts/current`; assert the backend end is start plus
  exactly 604800 seconds. No cards surround the content.
- [ ] **E02 — Account requires login.** In a fresh browser, open `/account` and
  verify the existing login UI appears. Sign in to a known trial account and
  verify that account's license page loads. The account must come from the
  authenticated identity.
- [ ] **E03 — Trial survives a new browser session.** Create a trial account,
  close the browser, sign in from a fresh session and open Account. License
  type, original start and original end must be unchanged.
- [ ] **E04 — Start hosted Checkout.** Click Buy lifetime access and verify the
  browser navigates to Stripe-hosted sandbox Checkout for BeddyBytes lifetime
  access with the configured amount/currency. It must be a browser navigation
  through `POST /payment/start`, not a fetch-only redirect. The access token
  must not appear in the destination URL.
- [ ] **E05 — Successful purchase and browser return.** Complete Checkout with
  a successful sandbox card. Follow the proxy return to `/payment/callback`;
  verify a single Payment Successful page heading, purchase confirmation and
  Go to account link. Follow that link and verify Perpetual, its start time,
  no Ends row and no checkout button. Check `/accounts/current` confirms the
  same license. Allow for the asynchronous webhook/callback delivery order.
- [ ] **E06 — Cancel Checkout and retry.** Leave an open Checkout using its
  cancellation/back-to-app control. Verify `/payment/callback` carries
  `error=payment_cancelled`, displays one Payment Failed heading and explains
  cancellation. Go to Account: the trial dates are unchanged and checkout is
  still available. Retry while the session remains open and unexpired; the
  existing Checkout Session is reused and can be completed successfully.
- [ ] **E07 — Card decline remains unpaid.** Submit a sandbox decline card.
  Verify Stripe's inline decline message; do not assume a decline redirects to
  our callback. Return to Account through cancellation/navigation and verify
  the account remains Trial with its original dates. Correct the payment with
  a successful card and verify eventual Perpetual.
- [ ] **E08 — Refresh after webhook-only payment.** Before paying, keep Account
  open in a second tab. In the Checkout tab block only the browser's success
  return request, while allowing Stripe to accept the payment. Observe the
  license becoming Perpetual through the API while no success callback was
  reached. The already-open Account tab retains its trial display until Refresh
  is clicked; Refresh then displays Perpetual. This proves real CLI webhook
  fulfillment independently of the browser success handler.
- [ ] **E09 — Paid account survives a fresh session.** After a confirmed
  purchase, sign in from a new browser session and open Account. Perpetual and
  its original grant time remain, with no Ends row or purchase button.

## Callback behavior and navigation

- [ ] **E10 — Return URL is reloadable.** Reload a successful backend return URL
  containing its session ID. It still reaches Payment Successful, with no
  second charge or changed perpetual start time. Reloading the frontend callback
  alone must only redisplay the result, not initiate payment or alter the license.
- [ ] **E11 — Callback display does not grant access.** Open
  `/payment/callback` directly for a trial account, without making a payment.
  The result page may show Payment Successful, but Go to account still shows
  the original Trial and the API license is unchanged. Query parameters and
  result text are not evidence of a purchase.
- [ ] **E12 — Callback error messages.** Visit the callback with
  `payment_failed`, `payment_cancelled`, `payment_pending`,
  `temporarily_unavailable`, `invalid_request` and an unknown error code.
  Each shows one Payment Failed heading, the appropriate friendly message and
  an Account link. No success confirmation or raw backend error is shown.
  These are presentation tests, not proof that the corresponding Stripe outcome
  was produced.
- [ ] **E13 — Missing session on the backend return.** Visit
  `/payment/stripe/success` without a session ID. It redirects to the frontend
  callback with `error=invalid_request` and leaves the license unchanged.
- [ ] **E14 — No success from a bad session.** Visit the backend success route
  with an invalid/nonexistent Checkout Session ID. It shows the friendly
  unavailable result through the callback, rather than Payment Successful, and
  does not alter the account.
- [ ] **E15 — Mobile account and callback pages.** At a phone-sized viewport,
  open the navbar menu and navigate to Account. License dates, Refresh, checkout
  and callback Account link are visible and usable without horizontal scrolling.

## Cases requiring controlled fixtures or service control

These remain unverified until the stated setup exists. Seed only isolated local
or QA test data using the event model; do not add a production fixture endpoint.

- [ ] **E16 — Expired trial display and checkout.** Requires a V2 account whose
  persisted trial start is more than seven days ago. Verify the original start
  and backend end are displayed, and checkout remains available. Complete a
  sandbox purchase and verify Perpetual. Do not wait a week or alter only the
  browser clock to simulate backend expiry.
- [ ] **E17 — Legacy account display.** Requires a seeded V1 account. Sign in
  and verify Perpetual, the creation time as its license start, no Ends row and
  no purchase button. No Stripe call should be needed.
- [ ] **E18 — Provisional display.** Requires a reproducible processing payment
  or a seeded provisional-license grant. Verify Provisional, its grant start,
  the processing message, no Ends row and no purchase button. A seeded case
  verifies display/replay only; do not call it a Stripe end-to-end payment test.
- [ ] **E19 — Provisional resolution through manual refresh.** Requires a
  controlled processing payment or event fixture. Resolve to paid and verify
  Refresh displays Perpetual. In a separate case revoke provisional access and
  verify Refresh restores the original Trial start/end and purchase button.
- [ ] **E20 — Account fetch failure and retry.** Requires browser-only request
  blocking or a scoped API outage. Open Account with `/accounts/current`
  unavailable, verify a friendly error, restore connectivity and click Refresh.
  The current license appears without another login. Other users' requests
  must not be disrupted by browser-only interception.
- [ ] **E21 — No automatic refresh.** Instrument account requests for one
  browser. After initial page load settles, change the backend license and
  trigger tab focus/visibility changes. No new account fetch occurs and the
  display does not change until Refresh is clicked. Account for React Strict
  Mode's duplicate initial effect in development; do not assert a single
  initial request as a production invariant.
- [ ] **E22 — Success callback without webhook delivery.** Requires pausing the
  CLI listener while a sandbox payment completes. The browser success callback
  retrieves/fulfills the paid session and Account shows Perpetual. Resume the
  listener afterward; any subsequent notification must not change the grant
  time or create another effective transition. Restore service state in cleanup.
- [ ] **E23 — License survives backend restart.** Requires container control and
  retention of the same event log. After a confirmed purchase, restart the API
  and use Refresh or a new browser session. Perpetual and its grant time survive.
  Recreating a container with an empty event log is not this test.
- [ ] **E24 — Additional card authentication.** Requires a sandbox 3DS flow
  that can be completed by the test browser. Successful authentication reaches
  Payment Successful and Perpetual. Failed/abandoned authentication must not
  falsely confirm payment; accept Stripe's inline flow or its cancellation
  return rather than assuming one fixed redirect for all failures.

## Scope and known limitations

The account page displays licensing; it does not decide monitoring access.
Token-scope enforcement and continuing an active monitoring session at trial
expiry are separate implementation/test work, not passing criteria for this UI
checklist.

Keep create/sync concurrency, event-log ordering, signature validation and replay
exhaustiveness in the existing Go tests. Selenium should prove the integrated
user journeys rather than reproduce every repository test.

The accepted overlapping-processing-payment limitation remains in
[KNOWN_LIMITATIONS.md](../golang/internal/paymentrepository/KNOWN_LIMITATIONS.md).
Do not add a Selenium expectation that the existing implementation automatically
resolves two overlapping processing attempts.

Hosted Checkout can require interaction that blocks browser automation. Record
such a case as blocked and retain a manual sandbox check; do not report it as
passed or weaken assertions to get through it. See Stripe's
[automated testing guidance](https://docs.stripe.com/automated-testing) and
[sandbox test data](https://docs.stripe.com/testing).

## Current status

17 October 2026: checklist created after local Stripe setup was reported running.
No new Selenium tests have been implemented or run for this checklist. All cases
are pending; seeded-license and service-control requirements are called out above.
The existing Selenium account-management suite remains unchanged.
