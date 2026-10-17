import os
import re
from urllib.parse import parse_qs, urlsplit

from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions
from selenium.webdriver.support.ui import Select
from selenium.webdriver.support.wait import WebDriverWait

from payment_test_utils import PaymentBrowserTestCase


class TestPayments(PaymentBrowserTestCase):
    capture_network = True

    def test_e04_start_hosted_checkout(self):
        self.create_trial_account()
        self.open_account()
        # Check the actual form before submitting: Chrome's performance log
        # attaches to the new tab after its initial navigation, missing the POST.
        checkout_form = self.driver.find_element(By.CSS_SELECTOR, "main form")
        self.assertEqual(checkout_form.get_attribute("method"), "post")
        self.assertEqual(urlsplit(checkout_form.get_attribute("action")).path, "/payment/start")
        self.assertEqual(checkout_form.get_attribute("target"), "_blank")
        self.start_checkout()
        self.assertNotIn("access_token", self.driver.current_url)
        self.wait.until(expected_conditions.visibility_of_element_located(
            (By.CSS_SELECTOR, "form")
        ))
        self.assertIn("BeddyBytes", self.driver.find_element(By.TAG_NAME, "body").text)
        # Supply the chosen sandbox total as an explicit fixture, avoiding a
        # guessed amount/currency or accepting whatever the page happens to show.
        expected_total = os.getenv("PAYMENT_EXPECTED_CHECKOUT_TOTAL")
        if not expected_total:
            self.skipTest("Set PAYMENT_EXPECTED_CHECKOUT_TOTAL to verify the configured sandbox amount/currency")
        self.assertIn(expected_total, self.driver.find_element(By.TAG_NAME, "body").text)
        self.assertIn("cs_test_", self.driver.current_url, "Checkout must use a sandbox session")

    def start_checkout(self):
        account_window = self.driver.current_window_handle
        previous_windows = self.driver.window_handles
        self.driver.find_element(
            By.XPATH, "//main//button[normalize-space(.)='Buy lifetime access']"
        ).click()
        self.wait.until(expected_conditions.new_window_is_opened(previous_windows))
        checkout_window = next(window for window in self.driver.window_handles if window not in previous_windows)
        self.driver.switch_to.window(account_window)
        self.assertEqual(urlsplit(self.driver.current_url).path, "/account")
        self.assertTrue(self.driver.find_element(
            By.XPATH, "//main//button[normalize-space(.)='Buy lifetime access']"
        ).is_enabled())
        self.assertTrue(self.driver.find_element(
            By.XPATH, "//main//button[normalize-space(.)='Refresh']"
        ).is_enabled())
        self.driver.switch_to.window(checkout_window)
        self.wait.until(lambda driver: urlsplit(driver.current_url).hostname == "checkout.stripe.com")
        self.assertTrue(self.driver.execute_script("return window.opener === null;"))
        self.assertIn("cs_test_", self.driver.current_url, "Refusing to submit outside sandbox Checkout")
        return re.search(r"cs_test_[A-Za-z0-9]+", self.driver.current_url).group(0)

    def pay_with_sandbox_card(self, email, card_number="4242424242424242"):
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
        checkout_wait = WebDriverWait(
            self.driver, timeout=float(os.getenv("PAYMENT_CHECKOUT_TIMEOUT_SECONDS", "60"))
        )
        checkout_wait.until(
            lambda driver: urlsplit(driver.current_url).path == "/payment/callback",
            "Paid Checkout did not reach the payment callback",
        )

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
        self.assertEqual(account["license"]["type"], "Perpetual")
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
        self.wait.until(expected_conditions.element_to_be_clickable((By.NAME, "email")))
        self.wait.until(expected_conditions.element_to_be_clickable(
            (By.CSS_SELECTOR, 'a[aria-label="Back to BeddyBytes"] svg')
        )).click()
        self.wait.until(lambda driver: urlsplit(driver.current_url).path == "/payment/callback")
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
        account_window = self.driver.current_window_handle
        before = self.read_account(email, password)
        original_session = self.start_checkout()
        self.driver.close()
        self.driver.switch_to.window(account_window)
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
