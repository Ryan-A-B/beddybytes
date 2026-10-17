# Account licenses and payments: Selenium end-to-end test list

Maintain this checklist as tests are implemented and run. An unchecked item is
not yet verified. Check an item only after its implemented test passes against
the configured local stack, and record the test name and evidence. A fixture or
infrastructure dependency is not a passing test. This document does not implement
or execute the tests.

Use the existing Python unittest/Selenium suite under `integration_tests/src/tests/`.
Suggested modules: `test_account_license.py` and `test_payments.py`. Work through
the core cases first, one test at a time. Stop on failures in application
behavior. When a Stripe interaction or test prerequisite cannot establish the
scenario, record it as inconclusive rather than an application failure.

Unittest has no separate inconclusive result: use a runtime skip prefixed with
`INCONCLUSIVE:` and preserve a screenshot. Such a result is not a pass. Scope
this handling to the hosted interaction, and retain assertions for our account,
license and callback behavior. Ordinary assertion failures and backend return
timeouts must not be converted wholesale into skips.

## Environment and test data

- Selenium Hub: `SELENIUM_HUB_URL`, default `http://localhost:4444`.
- Browser app: `https://app.beddybytes.local`.
- Account API: `API_BASE_URL`, default `https://api.beddybytes.local`.
- Browser payment returns: `https://api.local.beddybytes.com/payments/stripe/...`
  through the browser-accessible proxy, then the app's `/payments/callback`.
- Stripe webhook delivery: the running CLI listener forwards to
  `http://api:9000/payments/stripe/webhook`. It does not use the public proxy.
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

- [x] **E01 — Signup to trial account page.** (`TestAccountLicense.test_e01_signup_shows_trial_license`) Create an account through the UI,
  use the Account navbar link, and verify the Account heading, Trial license,
  Started and Ends values, Refresh button and Buy lifetime access button. Match
  both timestamps to `/accounts/current`; assert the backend end is start plus
  exactly 604800 seconds. No cards surround the content.
- [x] **E02 — Account requires login.** (`TestAccountLicense.test_e02_account_requires_login`) In a fresh browser, open `/account` and
  verify the existing login UI appears. Sign in to a known trial account and
  verify that account's license page loads. The account must come from the
  authenticated identity.
- [x] **E03 — Trial survives a new browser session.** (`TestAccountLicense.test_e03_trial_survives_new_browser_session`) Create a trial account,
  close the browser, sign in from a fresh session and open Account. License
  type, original start and original end must be unchanged.
- [ ] **SKIPPED E04 — Start hosted Checkout.** (`TestPayments.test_e04_start_hosted_checkout`; requires `PAYMENT_EXPECTED_CHECKOUT_TOTAL`) Click Buy lifetime access and verify the
  browser opens a new tab for Stripe-hosted sandbox Checkout for BeddyBytes lifetime
  access with the configured amount/currency. It must be a browser navigation
  through `POST /payments/start`, not a fetch-only redirect. The access token
  must not appear in the destination URL.
- [x] **E05 — Successful purchase and browser return.** (`TestPayments.test_e05_successful_purchase_and_browser_return`) Complete Checkout with
  a successful sandbox card. Follow the proxy return to `/payments/callback`;
  verify a single Payment Successful page heading, purchase confirmation and
  Go to account link. Follow that link and verify Perpetual, its start time,
  no Ends row and no checkout button. Check `/accounts/current` confirms the
  same license. Allow for the asynchronous webhook/callback delivery order.
- [x] **E06 — Cancel Checkout and retry.** (`TestPayments.test_e06_cancel_checkout_and_reuse_session`) Leave an open Checkout using its
  cancellation/back-to-app control. Verify `/payments/callback` carries
  `error=payment_cancelled`, displays one Payment Failed heading and explains
  cancellation. Go to Account: the trial dates are unchanged and checkout is
  still available. Retry while the session remains open and unexpired; the
  existing Checkout Session is reused and can be completed successfully.
- [x] **E06b — Close Checkout tab and reopen.** (`TestPayments.test_e06b_close_checkout_tab_and_reopen`) Close the Stripe tab. The original Account tab remains
  open with unchanged trial dates and usable Refresh and purchase controls.
  Refresh and reopen checkout; the original unexpired session is reused.
- [x] **E07 — Card decline remains unpaid.** (`TestPayments.test_e07_declined_card_remains_trial_and_can_retry`) Submit a sandbox decline card.
  Verify Stripe's accessible card-validation error (without matching Stripe wording); do not assume a decline redirects to
  our callback. Return to Account through cancellation/navigation and verify
  the account remains Trial with its original dates. Correct the payment with
  a successful card and verify eventual Perpetual.
- [ ] **SKIPPED E08 — Refresh after webhook-only payment.** (`TestPayments.test_e08_webhook_fulfills_without_browser_return`) Before paying, keep Account
  open in a second tab. In the Checkout tab block only the browser's success
  return request, while allowing Stripe to accept the payment. Observe the
  license becoming Perpetual through the API while no success callback was
  reached. The already-open Account tab retains its trial display until Refresh
  is clicked; Refresh then displays Perpetual. This proves real CLI webhook
  fulfillment independently of the browser success handler.
- [x] **E09 — Paid account survives a fresh session.** (`TestPayments.test_e09_perpetual_survives_new_browser_session`) After a confirmed
  purchase, sign in from a new browser session and open Account. Perpetual and
  its original grant time remain, with no Ends row or purchase button.

## Callback behavior and navigation

- [x] **E10 — Return URL is reloadable.** (`TestPayments.test_e10_payment_return_is_reloadable`) Reload a successful backend return URL
  containing its session ID. It still reaches Payment Successful, with no
  second charge or changed perpetual start time. Reloading the frontend callback
  alone must only redisplay the result, not initiate payment or alter the license.
- [x] **E11 — Callback display does not grant access.** (`TestPayments.test_e11_callback_display_does_not_grant_license`) Open
  `/payments/callback` directly for a trial account, without making a payment.
  The result page may show Payment Successful, but Go to account still shows
  the original Trial and the API license is unchanged. Query parameters and
  result text are not evidence of a purchase.
- [x] **E12 — Callback error messages.** (`TestPayments.test_e12_callback_error_messages`) Visit the callback with
  `payment_failed`, `payment_cancelled`, `payment_pending`,
  `temporarily_unavailable`, `invalid_request` and an unknown error code.
  Each shows one Payment Failed heading, the appropriate friendly message and
  an Account link. No success confirmation or raw backend error is shown.
  These are presentation tests, not proof that the corresponding Stripe outcome
  was produced.
- [x] **E13 — Missing session on the backend return.** (`TestPayments.test_e13_backend_return_without_session`) Visit
  `/payments/stripe/success` without a session ID. It redirects to the frontend
  callback with `error=invalid_request` and leaves the license unchanged.
- [x] **E14 — No success from a bad session.** (`TestPayments.test_e14_backend_return_with_invalid_session`) Visit the backend success route
  with an invalid/nonexistent Checkout Session ID. It shows the friendly
  unavailable result through the callback, rather than Payment Successful, and
  does not alter the account.
- [x] **E15 — Mobile account and callback pages.** (`TestPayments.test_e15_mobile_account_and_callback`) At a phone-sized viewport,
  open the navbar menu and navigate to Account. License dates, Refresh, checkout
  and callback Account link are visible and usable without horizontal scrolling.

## Cases requiring controlled fixtures or service control

These remain unverified until the stated setup exists. Seed only isolated local
or QA test data using the event model; do not add a production fixture endpoint.

- [ ] **SKIPPED E16 — Expired trial display and checkout.** (`TestPayments.test_e16_expired_trial_can_purchase`) Requires a V2 account whose
  persisted trial start is more than seven days ago. Verify the original start
  and backend end are displayed, and checkout remains available. Complete a
  sandbox purchase and verify Perpetual. Do not wait a week or alter only the
  browser clock to simulate backend expiry.
- [ ] **SKIPPED E17 — Legacy account display.** (`TestPayments.test_e17_legacy_account_shows_perpetual`) Requires a seeded V1 account. Sign in
  and verify Perpetual, the creation time as its license start, no Ends row and
  no purchase button. No Stripe call should be needed.
- [ ] **SKIPPED E18 — Provisional display.** (`TestPayments.test_e18_provisional_license_display`) Requires a reproducible processing payment
  or a seeded provisional-license grant. Verify Provisional, its grant start,
  the processing message, no Ends row and no purchase button. A seeded case
  verifies display/replay only; do not call it a Stripe end-to-end payment test.
- [ ] **E19 — Provisional resolution through manual refresh.** Requires a
  controlled processing payment or event fixture. Resolve to paid and verify
  Refresh displays Perpetual. In a separate case revoke provisional access and
  verify Refresh restores the original Trial start/end and purchase button.
- [x] **E20 — Account fetch failure and retry.** (`TestPayments.test_e20_account_fetch_failure_and_retry`) Requires browser-only request
  blocking or a scoped API outage. Open Account with `/accounts/current`
  unavailable, verify a friendly error, restore connectivity and click Refresh.
  The current license appears without another login. Other users' requests
  must not be disrupted by browser-only interception.
- [x] **E21 — No automatic refresh.** (`TestPayments.test_e21_account_refreshes_only_on_request`) Instrument account requests for one
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
- [ ] **INCONCLUSIVE E24 — Additional card authentication.** (`TestPayments.test_e24a_failed_card_authentication_keeps_trial`, `TestPayments.test_e24b_successful_card_authentication_grants_perpetual`) Requires a sandbox 3DS flow
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

17 October 2026: checkout now opens in a new tab with `noopener`. The original
Account tab stays available, including Refresh and reopening checkout. Stripe's
top-left back arrow cancels Checkout. Its wrapping link has zero size, so the
Selenium test clicks the visible arrow inside the accessible Back to BeddyBytes
link after the checkout form loads.

| Case | Test method | Result |
| --- | --- | --- |
| E01 | `TestAccountLicense.test_e01_signup_shows_trial_license` | Prior PASS — 4.919s |
| E02 | `TestAccountLicense.test_e02_account_requires_login` | Prior PASS — 5.297s |
| E03 | `TestAccountLicense.test_e03_trial_survives_new_browser_session` | Prior PASS — 8.492s |
| E04 | `TestPayments.test_e04_start_hosted_checkout` | SKIPPED — 4.686s; new-tab form and sandbox navigation assertions passed; expected total not supplied |
| E05 | `TestPayments.test_e05_successful_purchase_and_browser_return` | Prior PASS — 12.340s; purchase and return also exercised by E06 after the new-tab change |
| E06 | `TestPayments.test_e06_cancel_checkout_and_reuse_session` | PASS — 14.580s; actual back-arrow cancellation, unchanged trial, session reuse and successful sandbox purchase |
| E06b | `TestPayments.test_e06b_close_checkout_tab_and_reopen` | PASS — closing Stripe preserves Account, Refresh and session reuse |

E04 now checks the live form's POST method, payment start action and new-tab
target before navigating to sandbox Checkout. Chrome's performance log misses
the new tab's initial POST because logging attaches after navigation. The
frontend unit test separately verifies native form submission with a fresh token.
The amount/currency assertion remains skipped until an independent expected
total is supplied. E08 is implemented but fails its browser-interception setup (see below). Subsequent results are recorded below.

Account frontend tests pass (6 tests), and TypeScript checking passes.

Shared browser setup is in `src/payment_test_utils.py`. Failed tests save
screenshots under `artifacts/payments/` (ignored generated files); override
with `PAYMENT_TEST_ARTIFACTS`. Tests fix the browser time zone to UTC, use unique
accounts and never log observer access tokens. Existing account-management
Selenium tests are unchanged.

Run one case from `integration_tests/src` with the installed requirements:

```sh
SELENIUM_HUB_URL=http://selenium_hub:4444 \
  python -m unittest -v tests.test_payments.TestPayments.test_e06_cancel_checkout_and_reuse_session
```

Use `http://localhost:4444` when running on the Docker host. Configure waits with
`PAYMENT_UI_TIMEOUT_SECONDS` (default 15) and
`PAYMENT_CHECKOUT_TIMEOUT_SECONDS` (default 60).

E04 also requires `PAYMENT_EXPECTED_CHECKOUT_TOTAL`, containing the exact visible
sandbox total including its currency marker. Its missing value produces a skip,
not a pass. The expected total must be supplied independently of the page under
test; a value has been requested from the human.

The human's change to `config/local.sops.env` remains untouched.

## E07 run — 17 October 2026

Implemented `TestPayments.test_e07_declined_card_remains_trial_and_can_retry`
and extracted card submission from the helper that waits for a successful
return. The case submits Stripe's documented generic decline card, expects an
inline decline, verifies the original trial, cancels and reopens the same
session, then retries with the successful card.

**ERROR — 21.948s:** timed out waiting for the exact substring
`Your card was declined`. The screenshot instead shows:

> Your credit card was declined. Try paying with a debit card instead.

This is a test assertion mismatch. Stripe displayed a decline, but the test
stopped before checking the account license, cancellation or successful retry.
Those parts remain unverified. Retained the failing test and stopped without
adding E08 or changing application behavior. Next step: match the displayed
decline appropriately, then rerun E07 before continuing.

Evidence: [E07 decline screenshot](artifacts/payments/test_e07_declined_card_remains_trial_and_can_retry.png).
Card fixture reference: [Stripe sandbox test cards](https://docs.stripe.com/testing).

### E07 follow-up

**PASS — 19.807s.** Replaced the Stripe wording assertion with visible
`aria-invalid="true"` on the card number and a visible `role="alert"`.
The original trial remains unchanged after decline and cancellation; reopening
reuses the same session, and a successful card retry grants Perpetual.
Do not assert Stripe's error copy: we do not control its wording or locale.

## E08 run — 17 October 2026

**ERROR — 66.438s:** the test configured Chrome's `Network.setBlockedURLs` for
`*/payments/stripe/success*` in the Checkout tab, submitted a sandbox payment,
and waited for a corresponding blocked network request. No blocked return was
observed. The screenshot shows our **Payment Successful** page, so the intended
browser-return isolation did not take effect. This is a test setup failure,
not evidence that webhook fulfillment is broken. The API fulfillment and
manual-refresh assertions were not reached.

Stopped and retained the failing case. Next step: correct interception for the
new Checkout tab in this Remote Chrome setup, verify the return is actually
blocked, then rerun E08. Do not count a successful payment callback as evidence
of webhook-only fulfillment.

Evidence: [E08 failed interception screenshot](artifacts/payments/test_e08_webhook_fulfills_without_browser_return.png).

E08 is explicitly skipped at Ryan’s request. The unittest skip decorator prevents
its interception setup from running in the suite. Webhook-only fulfillment
remains unverified; this is not a passing case.

## Continued after skipping E08 — 17 October 2026

E08 is disabled with `unittest.skip` at Ryan's request. No changes to application
behavior were needed for the following tests. Each new case was run separately.

| Case | Result | Evidence |
| --- | --- | --- |
| E08 | SKIPPED | Explicit unittest skip verified alongside E09 |
| E09 | PASS — 13.839s including skipped E08 | Actual purchase, fresh browser/login, same account and perpetual grant timestamp, no checkout or end date |
| E10 | PASS — 13.295s | Actual purchase, revisit backend success return twice, refresh frontend callback, unchanged account/grant |
| E11 | PASS — 2.258s | Direct success-page navigation leaves account Trial, original dates and purchase control unchanged |
| E12 | PASS — 1.710s | All five known callback errors and an unknown code display the appropriate friendly failure and account link |
| E13 | PASS — 2.963s | Missing backend session redirects with invalid_request and leaves Trial unchanged |
| E14 | PASS — 3.108s | Nonexistent session redirects with temporarily_unavailable and leaves Trial unchanged |
| E15 | PASS — 4.419s | 390×844 window: navbar, account dates/controls, new checkout tab, success/failure callbacks and account links; no horizontal overflow |
| E20 | PASS — 2.174s | Block only this browser's account requests, show load error, unblock and Refresh successfully without login |
| E21 | PASS — 12.305s | Count actual account fetches, complete a purchase in another tab, verify focus/visibility events leave original Trial and request count unchanged, then Refresh fetches Perpetual |

E16–E19 remain unimplemented: no isolated expired V2, legacy V1 or provisional
payment/event fixtures are available. E22–E23 remain unimplemented: this agent
environment has no Docker CLI/socket for pausing the listener or restarting the
API. These are outstanding prerequisites, not passing tests. E20's blocking
works on the original app tab; it does not resolve E08's new-tab interception.

E10 checks grant idempotency and result navigation; it does not independently
query Stripe's charge ledger. E21 checks real tab return plus dispatched focus
and visibility events; it does not simulate time passing through a long polling
interval.

### E24 — stopped at authentication interaction

**ERROR — 25.290s.** Submitted Stripe's documented 3DS-required sandbox card
`4000000000003220`, found the test authentication failure control inside the
challenge iframe and called click. The test then timed out waiting for a visible
error alert. The screenshot still shows the 3D Secure test challenge with its
Fail/Complete controls, over a processing Checkout page.

This is an unresolved hosted-authentication interaction/outcome failure. It does
not establish an application defect or a license grant after failed authentication.
The original-account assertion and successful-authentication retry were not
reached. No exact Stripe error wording is asserted. Retained the failing test
and stopped; the next step is to investigate why the challenge did not resolve
and whether the test must observe a different outcome.

Evidence: [E24 authentication screenshot](artifacts/payments/test_e24_additional_card_authentication.png).
Fixture: [Stripe 3D Secure test cards](https://docs.stripe.com/testing#regulatory-cards).

### Outcome classification clarification

Ryan clarified that an unestablished Stripe UI outcome is **inconclusive**, not
an application failure. E24 now reports `INCONCLUSIVE:` through a unittest skip
when the hosted challenge control/outcome times out. It first checks that the
original account is unchanged and the browser remains on Stripe. An incorrect
license or a failure after reaching our callback still fails normally.
Screenshots are retained for inconclusive runtime skips as well as failures.
E08 remains explicitly skipped at Ryan's request; its prior interception attempt
was inconclusive about webhook-only fulfillment.

Verification: E24 rerun **INCONCLUSIVE — 28.499s**, reported as one unittest
skip. The backend account remained identical to the original Trial. The
challenge screenshot was saved; successful authentication remains unverified.

### Shared handling for all hosted interactions

All implemented payment scenarios use the shared `stripe_interaction` context
for hosted form loading, card entry/submission, decline detection, cancellation,
authentication, and waiting for Stripe to return. Missing/changed controls,
non-interactable elements and hosted timeouts produce `INCONCLUSIVE:` skips
with screenshots while the browser remains on Stripe. Tests do not continue to
a passing result after an unestablished Stripe step.

The handler does not swallow assertion failures or errors on our app/API.
License, session reuse, configured product/price, sandbox mode, callback results
and app navigation assertions remain checks of our integration. Negative
payment outcomes also check the original account before an inconclusive skip.
E08 remains explicitly skipped; no webhook-isolation claim is made.

`tests.test_payment_outcomes` verifies the classification without a browser:
hosted interaction errors skip, app/API timeouts and license assertion failures
propagate, and account checks run before skipping.

Verification of shared handling: all **5 outcome-classification tests pass**.
The live successful-purchase case E05 passed. During E06, the remote browser
stopped responding; a separate browser-URL request also timed out while Grid
itself remained healthy. The verification process was stopped and session
cleanup requested. This rerun is **INCONCLUSIVE (browser infrastructure)**;
E06, E07 and E24 are not newly verified by this run. Their earlier results
remain historical evidence, not fresh passes for this change. No application
behavior was changed.

## Next outstanding cases — 17 October 2026

Split E24 into independent authentication-failure and authentication-success
cases. An inconclusive failure challenge no longer prevents the approval case
from being attempted.

| Case | Latest result |
| --- | --- |
| E16 | SKIPPED — expired-trial account fixture not configured |
| E17 | SKIPPED — legacy V1 account fixture not configured |
| E18 | SKIPPED — provisional account fixture not configured |
| E24a | INCONCLUSIVE — 27.041s; failure challenge did not resolve; backend Trial verified unchanged |
| E24b | INCONCLUSIVE — 71.468s; clicked the approval control but Stripe remained on its challenge page instead of returning |

The new E16–E18 test bodies are implemented but **unverified** until real seeded
accounts are supplied. Only their missing-prerequisite skips have been run.
E16 verifies the persisted expired trial and its backend dates before attempting
a real sandbox purchase. E17 verifies the V1 fixture's perpetual start equals its
creation time, no expiry/purchase UI and no browser Stripe request. This last
check does not inspect server-to-Stripe traffic. E18 verifies provisional type,
grant start, processing message, no expiry/purchase UI and usable Refresh.

### Account fixture contract

`fixtures/accounts.example.json` documents the required values. Copy it to
`fixtures/accounts.local.json` (ignored) and populate it with **isolated accounts
already seeded through the backend event model**, including their expected
account IDs and license output. Set `PAYMENT_ACCOUNT_FIXTURES` to its absolute
path. This file is an expectation/credential manifest, not a seeder. Do not
commit local credentials. Missing files with a configured path, malformed data,
failed login or a mismatch with the seeded expectations fail rather than being
silently accepted. A missing fixture entry is an explicit inconclusive skip.

Use an expendable expired-trial account: E16 upgrades it, so re-seed a fresh
fixture before rerunning. V1 provenance must come from the seed event log;
perpetual display by itself does not prove an account originated as V1.
Provisional fixtures must not have an active payment resolving concurrently.
Do not simulate backend expiry with the browser clock or fabricate API responses
and count those as end-to-end passes.

Run from `integration_tests/src` with the fixture manifest configured:

```sh
PAYMENT_ACCOUNT_FIXTURES=/absolute/path/to/accounts.local.json \
SELENIUM_HUB_URL=http://selenium_hub:4444 \
python -m unittest -v tests.test_payments.TestPayments.test_e16_expired_trial_can_purchase
```

E19 still needs a controlled provisional transition through real events. E22
needs a pausable webhook listener; E23 needs API restart control plus a retained
event log. Neither Docker CLI nor its socket is available here, and the current
API event log lives inside its container. These three cases remain unimplemented
rather than adding empty tests or claiming mocked transitions as integration
coverage. E04 still needs the independent expected total; E08 remains skipped.

Evidence: [E24b unresolved approval](artifacts/payments/test_e24b_successful_card_authentication_grants_perpetual.png).

Outcome-classification checks rerun: **5 passed**. Fixture cases: **3 skipped**.
No application failures were found in this continuation.
