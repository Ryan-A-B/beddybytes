import copy
import datetime
import os
from pathlib import Path
import unittest

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions
from selenium.webdriver.support.wait import WebDriverWait

from backend_api_utils import BackendAPIClient
from settings import app_base_url, api_base_url, chrome_options, hub_url
from utils import generate_random_string


class PaymentBrowserTestCase(unittest.TestCase):
    capture_network = False

    def setUp(self):
        self.browsers = []
        self.addCleanup(self.close_browsers)
        self.start_browser()
        self.api = BackendAPIClient()
        self.addCleanup(self.api.session.close)

    def start_browser(self):
        options = copy.deepcopy(chrome_options)
        options.add_argument("--lang=en-GB")
        if self.capture_network:
            options.set_capability("goog:loggingPrefs", {"performance": "ALL"})
        self.driver = webdriver.Remote(command_executor=hub_url, options=options)
        self.browsers.append(self.driver)
        self.driver.set_page_load_timeout(30)
        self.driver.set_window_size(1440, 1000)
        # Selenium 4.17's generic Remote driver has no execute_cdp_cmd helper.
        self.driver.command_executor._commands["executeCdpCommand"] = (
            "POST", "/session/$sessionId/goog/cdp/execute"
        )
        self.driver.execute("executeCdpCommand", {
            "cmd": "Emulation.setTimezoneOverride", "params": {"timezoneId": "UTC"}
        })
        self.wait = WebDriverWait(
            self.driver, timeout=float(os.getenv("PAYMENT_UI_TIMEOUT_SECONDS", "15"))
        )

    def close_browsers(self):
        for browser in self.browsers:
            browser.quit()

    def tearDown(self):
        result = self._outcome.result
        if any(test is self for test, _ in result.errors + result.failures):
            directory = Path(os.getenv(
                "PAYMENT_TEST_ARTIFACTS",
                str(Path(__file__).resolve().parents[1] / "artifacts" / "payments"),
            ))
            directory.mkdir(parents=True, exist_ok=True)
            self.driver.save_screenshot(str(directory / f"{self._testMethodName}.png"))

    def create_trial_account(self):
        email = f"license-{generate_random_string(12)}@integrationtests.com"
        password = generate_random_string(24)
        self.driver.get(app_base_url)
        self.wait.until(expected_conditions.element_to_be_clickable(
            (By.ID, "nav-button-create-account")
        )).click()
        self.wait.until(expected_conditions.visibility_of_element_located(
            (By.ID, "form-create-account")
        ))
        self.driver.find_element(By.ID, "input-create-account-email").send_keys(email)
        self.driver.find_element(By.ID, "input-create-account-password").send_keys(password)
        self.driver.find_element(By.ID, "submit-button-create-account").click()
        self.wait.until(expected_conditions.visibility_of_element_located(
            (By.ID, "page-index")
        ))
        return email, password

    def open_account(self):
        self.wait.until(expected_conditions.element_to_be_clickable(
            (By.CSS_SELECTOR, 'nav a[href="/account"]')
        )).click()
        self.wait.until(expected_conditions.text_to_be_present_in_element(
            (By.CSS_SELECTOR, "main h1"), "Account"
        ))
        return self.wait.until(expected_conditions.visibility_of_element_located(
            (By.CSS_SELECTOR, 'section[aria-labelledby="license-heading"] h3')
        ))

    def read_account(self, email, password):
        access_token = self.api.login(email, password)
        response = self.api.session.get(
            f"{api_base_url}/accounts/current",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=15,
        )
        self.assertEqual(response.status_code, 200, "Account observer request failed")
        return response.json()

    def assert_displayed_license_dates(self, license_info):
        times = self.driver.find_elements(By.CSS_SELECTOR, "main time")
        seconds = [license_info["start_unix_seconds"], license_info["end_unix_seconds"]]
        self.assertEqual(len(times), 2)
        for element, timestamp in zip(times, seconds):
            expected_datetime = datetime.datetime.fromtimestamp(
                timestamp, tz=datetime.timezone.utc
            ).isoformat(timespec="milliseconds").replace("+00:00", "Z")
            self.assertEqual(element.get_attribute("datetime"), expected_datetime)
            expected_text = self.driver.execute_script(
                "return new Date(arguments[0] * 1000).toLocaleString(undefined, "
                "{dateStyle: 'long', timeStyle: 'short'});", timestamp,
            )
            self.assertEqual(element.text, expected_text)

