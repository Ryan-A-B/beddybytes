import json
import os
import re
import time
import unittest
from urllib.parse import parse_qs, urlsplit

from selenium.common.exceptions import NoSuchFrameException, StaleElementReferenceException
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions
from selenium.webdriver.support.ui import Select
from selenium.webdriver.support.wait import WebDriverWait

from payment_test_utils import PaymentBrowserTestCase
from settings import app_base_url


class TestPayments(PaymentBrowserTestCase):
    capture_network = True

    def test_e04_start_hosted_checkout(self):
        self.create_trial_account()
        self.open_account()
        # Check that checkout uses a same-tab form POST.
        checkout_form = self.driver.find_element(By.CSS_SELECTOR, "main form")
        self.assertEqual(checkout_form.get_attribute("method"), "post")
        self.assertEqual(urlsplit(checkout_form.get_attribute("action")).path, "/payments/start")
        self.assertFalse(checkout_form.get_attribute("target"))
        self.start_checkout()
        self.assertNotIn("access_token", self.driver.current_url)
        with self.stripe_interaction("Stripe hosted form did not load"):
            self.wait.until(expected_conditions.visibility_of_element_located(
                (By.CSS_SELECTOR, "form")
            ))
        self.assertIn("BeddyBytes", self.driver.find_element(By.TAG_NAME, "body").text)
        # Ryan confirmed the sandbox lifetime total is USD 35.00.
        # Other environments can supply their independently configured total.
        expected_total = os.getenv("PAYMENT_EXPECTED_CHECKOUT_TOTAL", "US$35.00")
        self.assertIn(expected_total, self.driver.find_element(By.TAG_NAME, "body").text)
        self.assertIn("cs_test_", self.driver.current_url, "Checkout must use a sandbox session")

    def start_checkout(self):
        account_window = self.driver.current_window_handle
        self.driver.find_element(
            By.XPATH, "//main//button[normalize-space(.)='Buy lifetime access']"
        ).click()
        with self.stripe_interaction("Stripe hosted checkout did not load"):
            self.wait.until(lambda driver: urlsplit(driver.current_url).hostname == "checkout.stripe.com")
        self.assertEqual(self.driver.current_window_handle, account_window)
        self.assertIn("cs_test_", self.driver.current_url, "Refusing to submit outside sandbox Checkout")
        return re.search(r"cs_test_[A-Za-z0-9]+", self.driver.current_url).group(0)

    def submit_sandbox_card(self, email, card_number="4242424242424242"):
        with self.stripe_interaction("Stripe card form could not be submitted"):
            email_input = self.wait.until(expected_conditions.element_to_be_clickable((By.NAME, "email")))
            email_input.clear()
            email_input.send_keys(email)
            link_checkbox = self.driver.find_element(By.NAME, "enableStripePass")
            if link_checkbox.is_selected():
                link_checkbox.click()
            for name, value in (
                ("cardNumber", card_number),
                ("cardExpiry", "1234"),
                ("cardCvc", "123"),
                ("billingName", "BeddyBytes Selenium"),
            ):
                field = self.wait.until(expected_conditions.element_to_be_clickable((By.NAME, name)))
                field.clear()
                field.send_keys(value)
            Select(self.driver.find_element(By.NAME, "billingCountry")).select_by_value("AU")
            self.wait.until(expected_conditions.element_to_be_clickable(
                (By.CSS_SELECTOR, "button[type='submit']")
            )).click()

    def pay_with_sandbox_card(self, email, card_number="4242424242424242"):
        self.submit_sandbox_card(email, card_number)
        with self.stripe_interaction("Stripe did not complete the expected browser return"):
            checkout_wait = WebDriverWait(
                self.driver, timeout=float(os.getenv("PAYMENT_CHECKOUT_TIMEOUT_SECONDS", "60"))
            )
            checkout_wait.until(
                lambda driver: urlsplit(driver.current_url).path == "/payments/callback",
                "Paid Checkout did not reach the payment callback",
            )

    def cancel_checkout(self):
        with self.stripe_interaction("Stripe back control did not return to the app"):
            self.wait.until(expected_conditions.element_to_be_clickable((By.NAME, "email")))
            self.wait.until(expected_conditions.element_to_be_clickable((
                By.CSS_SELECTOR, 'a[aria-label="Back to BeddyBytes"] svg'
            ))).click()
            self.wait.until(lambda driver: urlsplit(driver.current_url).path == "/payments/callback")

    def assert_success_and_perpetual(self, email, password):
        heading = self.wait.until(expected_conditions.visibility_of_element_located(
            (By.CSS_SELECTOR, "main h1")
        ))
        self.assertEqual(heading.text, "Payment Successful")
        self.assertEqual(len(self.driver.find_elements(By.CSS_SELECTOR, "main h1")), 1)
        self.assertIn("Thank you for your purchase.", self.driver.find_element(By.TAG_NAME, "main").text)
        self.driver.find_element(By.LINK_TEXT, "Go to account").click()
        license_heading = self.wait.until(expected_conditions.visibility_of_element_located(
            (By.CSS_SELECTOR, 'section[aria-labelledby="license-heading"] h3')
        ))
        self.assertEqual(license_heading.text, "Perpetual")
        self.assertEqual(len(self.driver.find_elements(By.CSS_SELECTOR, "main time")), 1)
        self.assertNotIn("Ends", [element.text for element in self.driver.find_elements(By.CSS_SELECTOR, "main dt")])
        self.assertFalse(self.driver.find_elements(By.XPATH, "//main//button[normalize-space(.)='Buy lifetime access']"))
        account = self.read_account(email, password)
        self.assertEqual(account["license"]["type"], "perpetual")
        expected_started = self.driver.execute_script(
            "return new Date(arguments[0] * 1000).toISOString();", account["license"]["start_unix_seconds"]
        )
        self.assertEqual(self.driver.find_element(By.CSS_SELECTOR, "main time").get_attribute("datetime"), expected_started)

    def test_e05_successful_purchase_and_browser_return(self):
        email, password = self.create_trial_account()
        self.open_account()
        self.start_checkout()
        self.pay_with_sandbox_card(email)
        self.assert_success_and_perpetual(email, password)

    def test_e06_cancel_checkout_and_reuse_session(self):
        email, password = self.create_trial_account()
        self.open_account()
        before = self.read_account(email, password)
        original_session = self.start_checkout()
        self.cancel_checkout()
        self.assertEqual(parse_qs(urlsplit(self.driver.current_url).query).get("error"), ["payment_cancelled"])
        self.assertEqual(self.driver.find_element(By.CSS_SELECTOR, "main h1").text, "Payment Failed")
        self.assertIn("Checkout was cancelled.", self.driver.find_element(By.TAG_NAME, "main").text)
        self.driver.find_element(By.LINK_TEXT, "Go to account").click()
        self.wait.until(expected_conditions.text_to_be_present_in_element(
            (By.CSS_SELECTOR, 'section[aria-labelledby="license-heading"] h3'), "Trial"
        ))
        self.assert_displayed_license_dates(before["license"])
        self.assertEqual(self.read_account(email, password), before)
        self.assertEqual(self.start_checkout(), original_session)
        self.pay_with_sandbox_card(email)
        self.assert_success_and_perpetual(email, password)

    def test_e06b_close_checkout_tab_and_reopen(self):
        email, password = self.create_trial_account()
        self.open_account()
        before = self.read_account(email, password)
        original_session = self.start_checkout()
        # Checkout occupies the original Account tab. Closing its only window
        # ends WebDriver's session, so reopen with a fresh browser and sign in.
        self.driver.quit()
        self.browsers.remove(self.driver)
        self.start_browser()
        self.login_fixture_account({
            "email": email,
            "password": password,
            "id": before["id"],
            "license": before["license"],
        })
        self.assertEqual(urlsplit(self.driver.current_url).path, "/account")
        self.assertEqual(self.driver.find_element(
            By.CSS_SELECTOR, 'section[aria-labelledby="license-heading"] h3'
        ).text, "Trial")
        self.assert_displayed_license_dates(before["license"])
        self.driver.find_element(
            By.XPATH, "//main//button[normalize-space(.)='Refresh']"
        ).click()
        self.wait.until(expected_conditions.element_to_be_clickable((
            By.XPATH, "//main//button[normalize-space(.)='Buy lifetime access']"
        )))
        self.assertEqual(self.read_account(email, password), before)
        self.assertEqual(self.start_checkout(), original_session)

    def test_e07_declined_card_remains_trial_and_can_retry(self):
        email, password = self.create_trial_account()
        self.open_account()
        before = self.read_account(email, password)
        original_session = self.start_checkout()
        # Stripe's documented generic decline card; this must stay in sandbox.
        self.submit_sandbox_card(email, "4000000000000002")
        with self.stripe_interaction(
            "Stripe decline outcome could not be established",
            before_skip=lambda: self.assertEqual(self.read_account(email, password), before),
        ):
            # Observe the accessible validation state, not Stripe's error wording.
            self.wait.until(expected_conditions.visibility_of_element_located((
                By.CSS_SELECTOR, 'input[name="cardNumber"][aria-invalid="true"]'
            )))
            self.wait.until(expected_conditions.visibility_of_element_located((
                By.CSS_SELECTOR, '[role="alert"]'
            )))
        self.assertEqual(urlsplit(self.driver.current_url).hostname, "checkout.stripe.com")
        self.assertEqual(self.read_account(email, password), before)
        self.cancel_checkout()
        self.assertEqual(parse_qs(urlsplit(self.driver.current_url).query).get("error"), ["payment_cancelled"])
        self.driver.find_element(By.LINK_TEXT, "Go to account").click()
        self.wait.until(expected_conditions.text_to_be_present_in_element((
            By.CSS_SELECTOR, 'section[aria-labelledby="license-heading"] h3'
        ), "Trial"))
        self.assert_displayed_license_dates(before["license"])
        self.assertEqual(self.start_checkout(), original_session)
        self.pay_with_sandbox_card(email)
        self.assert_success_and_perpetual(email, password)

    @unittest.skip("Skipped at Ryan's request: browser return interception needs separate work")
    def test_e08_webhook_fulfills_without_browser_return(self):
        email, password = self.create_trial_account()
        self.open_account()
        account_window = self.driver.current_window_handle
        before = self.read_account(email, password)
        self.start_checkout()
        self.driver.execute("executeCdpCommand", {"cmd": "Network.enable", "params": {}})
        self.driver.execute("executeCdpCommand", {
            "cmd": "Network.setBlockedURLs",
            "params": {"urls": ["*/payments/stripe/success*"]},
        })
        self.driver.get_log("performance")
        self.submit_sandbox_card(email)
        blocked_return_requests = set()

        def success_return_was_blocked(driver):
            for entry in driver.get_log("performance"):
                message = json.loads(entry["message"])["message"]
                parameters = message.get("params", {})
                if message["method"] == "Network.requestWillBeSent":
                    if urlsplit(parameters["request"]["url"]).path == "/payments/stripe/success":
                        blocked_return_requests.add(parameters["requestId"])
                elif message["method"] == "Network.loadingFailed":
                    if parameters["requestId"] in blocked_return_requests and parameters.get("blockedReason"):
                        return True
            return False

        webhook_wait = WebDriverWait(
            self.driver, timeout=float(os.getenv("PAYMENT_CHECKOUT_TIMEOUT_SECONDS", "60"))
        )
        webhook_wait.until(success_return_was_blocked, "Browser success return was not observed being blocked")
        webhook_wait.until(
            lambda driver: self.read_account(email, password)["license"]["type"] == "perpetual",
            "Webhook did not fulfill payment while the browser success return was blocked",
        )
        self.driver.switch_to.window(account_window)
        self.assertEqual(urlsplit(self.driver.current_url).path, "/account")
        self.assertEqual(self.driver.find_element(
            By.CSS_SELECTOR, 'section[aria-labelledby="license-heading"] h3'
        ).text, "Trial")
        self.assert_displayed_license_dates(before["license"])
        self.driver.find_element(
            By.XPATH, "//main//button[normalize-space(.)='Refresh']"
        ).click()
        self.wait.until(expected_conditions.text_to_be_present_in_element((
            By.CSS_SELECTOR, 'section[aria-labelledby="license-heading"] h3'
        ), "Perpetual"))
        self.assertFalse(self.driver.find_elements(
            By.XPATH, "//main//button[normalize-space(.)='Buy lifetime access']"
        ))
        self.assertEqual(len(self.driver.find_elements(By.CSS_SELECTOR, "main time")), 1)
        account = self.read_account(email, password)
        expected_started = self.driver.execute_script(
            "return new Date(arguments[0] * 1000).toISOString();", account["license"]["start_unix_seconds"]
        )
        self.assertEqual(self.driver.find_element(By.CSS_SELECTOR, "main time").get_attribute("datetime"), expected_started)

    def test_e09_perpetual_survives_new_browser_session(self):
        email, password = self.create_trial_account()
        self.open_account()
        self.start_checkout()
        self.pay_with_sandbox_card(email)
        self.assert_success_and_perpetual(email, password)
        paid_account = self.read_account(email, password)

        self.driver.quit()
        self.browsers.remove(self.driver)
        self.start_browser()
        self.driver.get(f"{app_base_url}/account")
        login_form = self.wait.until(expected_conditions.visibility_of_element_located((By.ID, "form-login")))
        self.assertIsNone(self.driver.execute_script("return localStorage.getItem('account');"))
        login_form.find_element(By.ID, "input-login-email").send_keys(email)
        login_form.find_element(By.ID, "input-login-password").send_keys(password)
        login_form.find_element(By.ID, "submit-button-login").click()
        self.wait.until(expected_conditions.text_to_be_present_in_element((
            By.CSS_SELECTOR, 'section[aria-labelledby="license-heading"] h3'
        ), "Perpetual"))
        self.assertEqual(self.read_account(email, password), paid_account)
        self.assertEqual(self.driver.execute_script(
            "return JSON.parse(localStorage.getItem('account')).id;"
        ), paid_account["id"])
        times = self.driver.find_elements(By.CSS_SELECTOR, "main time")
        self.assertEqual(len(times), 1)
        self.assertEqual(times[0].get_attribute("datetime"), self.driver.execute_script(
            "return new Date(arguments[0] * 1000).toISOString();",
            paid_account["license"]["start_unix_seconds"],
        ))
        self.assertFalse(self.driver.find_elements(By.XPATH, "//main//dt[normalize-space(.)='Ends']"))
        self.assertFalse(self.driver.find_elements(By.XPATH, "//main//button[normalize-space(.)='Buy lifetime access']"))

    def test_e10_payment_return_is_reloadable(self):
        email, password = self.create_trial_account()
        self.open_account()
        session_id = self.start_checkout()
        self.pay_with_sandbox_card(email)
        self.assert_success_and_perpetual(email, password)
        paid_account = self.read_account(email, password)
        return_base_url = os.getenv("PAYMENT_RETURN_BASE_URL", "https://api.local.beddybytes.com")
        return_url = f"{return_base_url}/payments/stripe/success?session_id={session_id}"
        # Revisit the backend URL twice: refreshing its redirect destination
        # alone would only exercise the frontend result page.
        for attempt in range(2):
            self.driver.get(return_url)
            self.wait.until(expected_conditions.text_to_be_present_in_element((
                By.CSS_SELECTOR, "main h1"
            ), "Payment Successful"))
            self.assertEqual(urlsplit(self.driver.current_url).path, "/payments/callback")
            self.assertNotIn("error", parse_qs(urlsplit(self.driver.current_url).query))
            self.assertEqual(self.read_account(email, password), paid_account)
        self.driver.refresh()
        self.wait.until(expected_conditions.text_to_be_present_in_element((
            By.CSS_SELECTOR, "main h1"
        ), "Payment Successful"))
        self.assertEqual(self.read_account(email, password), paid_account)
        self.assert_success_and_perpetual(email, password)

    def test_e11_callback_display_does_not_grant_license(self):
        email, password = self.create_trial_account()
        self.open_account()
        before = self.read_account(email, password)
        self.driver.get(f"{app_base_url}/payments/callback")
        self.wait.until(expected_conditions.text_to_be_present_in_element((
            By.CSS_SELECTOR, "main h1"
        ), "Payment Successful"))
        self.driver.find_element(By.LINK_TEXT, "Go to account").click()
        self.wait.until(expected_conditions.text_to_be_present_in_element((
            By.CSS_SELECTOR, 'section[aria-labelledby="license-heading"] h3'
        ), "Trial"))
        self.assert_displayed_license_dates(before["license"])
        self.assertEqual(self.read_account(email, password), before)
        self.assertTrue(self.driver.find_element(
            By.XPATH, "//main//button[normalize-space(.)='Buy lifetime access']"
        ).is_enabled())

    def test_e12_callback_error_messages(self):
        messages = {
            "payment_failed": "Your payment was not successful. You can try again from your account.",
            "payment_cancelled": "Checkout was cancelled. You can try again from your account.",
            "payment_pending": "Your payment is still processing. Check your account before starting another payment.",
            "temporarily_unavailable": "We could not confirm your payment. Check your account before trying again.",
            "invalid_request": "We could not verify this payment return. Please go to your account.",
            "unknown_error": "We could not complete your payment. Please check your account.",
        }
        for error_code, expected_message in messages.items():
            with self.subTest(error=error_code):
                self.driver.get(f"{app_base_url}/payments/callback?error={error_code}")
                self.wait.until(expected_conditions.text_to_be_present_in_element((
                    By.CSS_SELECTOR, "main h1"
                ), "Payment Failed"))
                self.assertEqual(len(self.driver.find_elements(By.CSS_SELECTOR, "main h1")), 1)
                result = self.driver.find_element(By.TAG_NAME, "main").text
                self.assertIn(expected_message, result)
                self.assertNotIn("Thank you for your purchase", result)
                self.assertNotIn(error_code, result)
                account_link = self.driver.find_element(By.LINK_TEXT, "Go to account")
                self.assertTrue(account_link.is_displayed())
                self.assertEqual(urlsplit(account_link.get_attribute("href")).path, "/account")

    def test_e13_backend_return_without_session(self):
        email, password = self.create_trial_account()
        before = self.read_account(email, password)
        return_base_url = os.getenv("PAYMENT_RETURN_BASE_URL", "https://api.local.beddybytes.com")
        self.driver.get(f"{return_base_url}/payments/stripe/success")
        self.wait.until(lambda driver: urlsplit(driver.current_url).path == "/payments/callback")
        self.assertEqual(parse_qs(urlsplit(self.driver.current_url).query).get("error"), ["invalid_request"])
        self.wait.until(expected_conditions.text_to_be_present_in_element((
            By.CSS_SELECTOR, "main h1"
        ), "Payment Failed"))
        self.assertEqual(self.read_account(email, password), before)
        self.driver.find_element(By.LINK_TEXT, "Go to account").click()
        self.wait.until(expected_conditions.text_to_be_present_in_element((
            By.CSS_SELECTOR, 'section[aria-labelledby="license-heading"] h3'
        ), "Trial"))
        self.assert_displayed_license_dates(before["license"])

    def test_e14_backend_return_with_invalid_session(self):
        email, password = self.create_trial_account()
        before = self.read_account(email, password)
        return_base_url = os.getenv("PAYMENT_RETURN_BASE_URL", "https://api.local.beddybytes.com")
        self.driver.get(f"{return_base_url}/payments/stripe/success?session_id=cs_test_nonexistent_selenium_session")
        self.wait.until(lambda driver: urlsplit(driver.current_url).path == "/payments/callback")
        self.assertEqual(parse_qs(urlsplit(self.driver.current_url).query).get("error"), ["temporarily_unavailable"])
        self.wait.until(expected_conditions.text_to_be_present_in_element((
            By.CSS_SELECTOR, "main h1"
        ), "Payment Failed"))
        result = self.driver.find_element(By.TAG_NAME, "main").text
        self.assertIn("We could not confirm your payment.", result)
        self.assertNotIn("cs_test_nonexistent_selenium_session", result)
        self.assertNotIn("Thank you for your purchase", result)
        self.assertEqual(self.read_account(email, password), before)

    def test_e15_mobile_account_and_callback(self):
        email, password = self.create_trial_account()
        account = self.read_account(email, password)
        self.driver.set_window_size(390, 844)
        self.wait.until(expected_conditions.element_to_be_clickable((
            By.CSS_SELECTOR, "nav button.navbar-toggler"
        ))).click()
        self.assertEqual(self.open_account().text, "Trial")
        self.assert_displayed_license_dates(account["license"])
        for label in ("Refresh", "Buy lifetime access"):
            button = self.driver.find_element(By.XPATH, f"//main//button[normalize-space(.)='{label}']")
            self.assertTrue(button.is_displayed())
            self.assertTrue(button.is_enabled())
        self.assertTrue(self.driver.execute_script(
            "return document.documentElement.scrollWidth <= window.innerWidth;"
        ), "Account page overflows horizontally")
        self.driver.find_element(By.XPATH, "//main//button[normalize-space(.)='Refresh']").click()
        self.wait.until(expected_conditions.element_to_be_clickable((
            By.XPATH, "//main//button[normalize-space(.)='Buy lifetime access']"
        )))
        self.start_checkout()
        for query, heading in (("", "Payment Successful"), ("?error=payment_cancelled", "Payment Failed")):
            self.driver.get(f"{app_base_url}/payments/callback{query}")
            self.wait.until(expected_conditions.text_to_be_present_in_element((
                By.CSS_SELECTOR, "main h1"
            ), heading))
            account_link = self.driver.find_element(By.LINK_TEXT, "Go to account")
            self.assertTrue(account_link.is_displayed())
            self.assertTrue(self.driver.execute_script(
                "return document.documentElement.scrollWidth <= window.innerWidth;"
            ), "Payment callback overflows horizontally")
            account_link.click()
            self.wait.until(expected_conditions.text_to_be_present_in_element((
                By.CSS_SELECTOR, 'section[aria-labelledby="license-heading"] h3'
            ), "Trial"))
            self.assert_displayed_license_dates(account["license"])

    def test_e20_account_fetch_failure_and_retry(self):
        email, password = self.create_trial_account()
        account = self.read_account(email, password)
        self.driver.execute("executeCdpCommand", {"cmd": "Network.enable", "params": {}})
        self.driver.execute("executeCdpCommand", {
            "cmd": "Network.setBlockedURLs", "params": {"urls": ["*/accounts/current*"]},
        })
        self.driver.find_element(By.CSS_SELECTOR, 'nav a[href="/account"]').click()
        self.wait.until(expected_conditions.visibility_of_element_located((By.CSS_SELECTOR, 'main [role="alert"]')))
        self.assertIn("Could not load your account.", self.driver.find_element(By.TAG_NAME, "main").text)
        self.assertFalse(self.driver.find_elements(By.CSS_SELECTOR, "main time"))
        self.driver.execute("executeCdpCommand", {
            "cmd": "Network.setBlockedURLs", "params": {"urls": []},
        })
        self.driver.find_element(By.XPATH, "//main//button[normalize-space(.)='Refresh']").click()
        self.wait.until(expected_conditions.text_to_be_present_in_element((
            By.CSS_SELECTOR, 'section[aria-labelledby="license-heading"] h3'
        ), "Trial"))
        self.assertFalse(self.driver.find_elements(By.CSS_SELECTOR, 'main [role="alert"]'))
        self.assertFalse(self.driver.find_elements(By.ID, "form-login"))
        self.assert_displayed_license_dates(account["license"])
        self.assertEqual(self.read_account(email, password), account)

    def test_e21_account_refreshes_only_on_request(self):
        email, password = self.create_trial_account()
        self.driver.execute_script("""
            const originalFetch = window.fetch;
            window.accountRequests = {count: 0, pending: 0};
            window.fetch = async function(resource, options) {
                const requestUrl = resource instanceof Request ? resource.url : String(resource);
                if (new URL(requestUrl, location.href).pathname !== '/accounts/current') {
                    return originalFetch.call(this, resource, options);
                }
                window.accountRequests.count++;
                window.accountRequests.pending++;
                try { return await originalFetch.call(this, resource, options); }
                finally { window.accountRequests.pending--; }
            };
        """)
        self.open_account()
        account_window = self.driver.current_window_handle
        self.wait.until(lambda driver: driver.execute_script("return window.accountRequests.pending === 0;"))
        original_count = self.driver.execute_script("return window.accountRequests.count;")
        self.assertGreater(original_count, 0)
        before = self.read_account(email, password)
        # Keep a separate account tab to verify manual refresh of an older view.
        self.driver.switch_to.new_window("tab")
        self.driver.get(f"{app_base_url}/account")
        self.wait.until(expected_conditions.element_to_be_clickable((
            By.XPATH, "//main//button[normalize-space(.)='Buy lifetime access']"
        )))
        self.start_checkout()
        self.pay_with_sandbox_card(email)
        self.assert_success_and_perpetual(email, password)
        self.driver.switch_to.window(account_window)
        self.driver.execute_async_script("""
            const done = arguments[arguments.length - 1];
            window.dispatchEvent(new Event('blur'));
            document.dispatchEvent(new Event('visibilitychange'));
            window.dispatchEvent(new Event('focus'));
            requestAnimationFrame(() => requestAnimationFrame(done));
        """)
        self.assertEqual(self.driver.execute_script("return window.accountRequests.count;"), original_count)
        self.assertEqual(self.driver.find_element(
            By.CSS_SELECTOR, 'section[aria-labelledby="license-heading"] h3'
        ).text, "Trial")
        self.assert_displayed_license_dates(before["license"])
        self.driver.find_element(By.XPATH, "//main//button[normalize-space(.)='Refresh']").click()
        self.wait.until(expected_conditions.text_to_be_present_in_element((
            By.CSS_SELECTOR, 'section[aria-labelledby="license-heading"] h3'
        ), "Perpetual"))
        self.assertGreater(self.driver.execute_script("return window.accountRequests.count;"), original_count)

    def respond_to_sandbox_authentication(self, approve):
        control_id = "test-source-authorize-3ds" if approve else "test-source-fail-3ds"

        def find_control_in_frames(driver):
            controls = driver.find_elements(By.ID, control_id)
            for control in controls:
                if control.is_displayed() and control.is_enabled():
                    return control
            for frame in driver.find_elements(By.TAG_NAME, "iframe"):
                driver.switch_to.frame(frame)
                control = find_control_in_frames(driver)
                if control:
                    return control
                driver.switch_to.parent_frame()
            return False

        def find_authentication_control(driver):
            driver.switch_to.default_content()
            try:
                return find_control_in_frames(driver)
            except (NoSuchFrameException, StaleElementReferenceException):
                driver.switch_to.default_content()
                return False

        control = self.wait.until(find_authentication_control, "Sandbox authentication control not available")
        control.click()
        self.driver.switch_to.default_content()

    def test_e24a_failed_card_authentication_keeps_trial(self):
        email, password = self.create_trial_account()
        self.open_account()
        before = self.read_account(email, password)
        self.start_checkout()
        # Stripe's 3DS-required sandbox card; failure must not grant a license.
        self.submit_sandbox_card(email, "4000000000003220")
        unchanged_account = lambda: self.assertEqual(self.read_account(email, password), before)
        with self.stripe_interaction(
            "Stripe failed-authentication outcome could not be established", before_skip=unchanged_account,
        ):
            self.respond_to_sandbox_authentication(approve=False)
            self.wait.until(expected_conditions.visibility_of_element_located((
                By.CSS_SELECTOR, '[role="alert"]'
            )))
        self.assertEqual(urlsplit(self.driver.current_url).hostname, "checkout.stripe.com")
        unchanged_account()

    def test_e24b_successful_card_authentication_grants_perpetual(self):
        email, password = self.create_trial_account()
        self.open_account()
        before = self.read_account(email, password)
        self.start_checkout()
        self.submit_sandbox_card(email, "4000000000003220")
        unchanged_account = lambda: self.assertEqual(self.read_account(email, password), before)
        with self.stripe_interaction(
            "Stripe authentication approval control was unavailable", before_skip=unchanged_account,
        ):
            self.respond_to_sandbox_authentication(approve=True)
        with self.stripe_interaction("Stripe authentication did not complete the expected browser return"):
            WebDriverWait(self.driver, float(os.getenv("PAYMENT_CHECKOUT_TIMEOUT_SECONDS", "60"))).until(
                lambda driver: urlsplit(driver.current_url).path == "/payments/callback"
            )
        self.assert_success_and_perpetual(email, password)

    @unittest.skipUnless(os.getenv("PAYMENT_ACCOUNT_FIXTURES"), "INCONCLUSIVE: expired-trial fixture is not configured")
    def test_e16_expired_trial_can_purchase(self):
        fixture = self.load_account_fixture("expired_trial")
        self.assertEqual(fixture["creation_event_type"], "account.created.v2")
        self.assertEqual(fixture["license"]["type"], "trial")
        self.assertLess(fixture["license"]["end_unix_seconds"], time.time())
        self.assertEqual(fixture["license"]["end_unix_seconds"] - fixture["license"]["start_unix_seconds"], 604800)
        account = self.login_fixture_account(fixture)
        self.assert_displayed_license_dates(account["license"])
        self.start_checkout()
        self.pay_with_sandbox_card(fixture["email"])
        self.assert_success_and_perpetual(fixture["email"], fixture["password"])

    @unittest.skipUnless(os.getenv("PAYMENT_ACCOUNT_FIXTURES"), "INCONCLUSIVE: legacy V1 fixture is not configured")
    def test_e17_legacy_account_shows_perpetual(self):
        fixture = self.load_account_fixture("legacy_v1")
        self.assertEqual(fixture["creation_event_type"], "account.created")
        self.assertEqual(fixture["license"]["type"], "perpetual")
        self.assertEqual(fixture["license"]["start_unix_seconds"], fixture["created_unix_seconds"])
        account = self.login_fixture_account(fixture)
        self.assertEqual(self.driver.find_element(
            By.CSS_SELECTOR, 'section[aria-labelledby="license-heading"] h3'
        ).text, "Perpetual")
        self.assert_single_license_start(account["license"])
        self.assertFalse(self.driver.find_elements(By.XPATH, "//main//button[normalize-space(.)='Buy lifetime access']"))
        # Observe this browser's network only; a legacy display needs no Stripe request.
        for entry in self.driver.get_log("performance"):
            message = json.loads(entry["message"])["message"]
            if message["method"] == "Network.requestWillBeSent":
                hostname = urlsplit(message["params"]["request"]["url"]).hostname or ""
                self.assertFalse(hostname == "stripe.com" or hostname.endswith(".stripe.com"))

    def assert_single_license_start(self, license_info):
        times = self.driver.find_elements(By.CSS_SELECTOR, "main time")
        self.assertEqual(len(times), 1)
        self.assertEqual(times[0].get_attribute("datetime"), self.driver.execute_script(
            "return new Date(arguments[0] * 1000).toISOString();", license_info["start_unix_seconds"]
        ))
        self.assertFalse(self.driver.find_elements(By.XPATH, "//main//dt[normalize-space(.)='Ends']"))

    @unittest.skipUnless(os.getenv("PAYMENT_ACCOUNT_FIXTURES"), "INCONCLUSIVE: provisional fixture is not configured")
    def test_e18_provisional_license_display(self):
        fixture = self.load_account_fixture("provisional")
        self.assertEqual(fixture["license"]["type"], "provisional")
        account = self.login_fixture_account(fixture)
        self.assertEqual(self.driver.find_element(
            By.CSS_SELECTOR, 'section[aria-labelledby="license-heading"] h3'
        ).text, "Provisional")
        self.assert_single_license_start(account["license"])
        self.assertIn("Your payment is processing.", self.driver.find_element(By.TAG_NAME, "main").text)
        self.assertFalse(self.driver.find_elements(By.XPATH, "//main//button[normalize-space(.)='Buy lifetime access']"))
        self.assertTrue(self.driver.find_element(By.XPATH, "//main//button[normalize-space(.)='Refresh']").is_enabled())
