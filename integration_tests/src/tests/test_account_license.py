from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions

from payment_test_utils import PaymentBrowserTestCase
from settings import app_base_url
from utils import generate_random_string


class TestAccountLicense(PaymentBrowserTestCase):
    def test_e01_signup_shows_trial_license(self):
        email, password = self.create_trial_account()
        license_heading = self.open_account()
        self.assertEqual(license_heading.text, "Trial")
        account = self.read_account(email, password)
        license_info = account["license"]
        self.assertEqual(license_info["type"], "trial")
        self.assertEqual(
            license_info["trial_detail"]["end_unix_seconds"] - license_info["start_unix_seconds"],
            604800,
        )
        self.assert_displayed_license_dates(license_info)
        self.assertEqual(
            [element.text for element in self.driver.find_elements(By.CSS_SELECTOR, "main dt")],
            ["Started", "Ends"],
        )
        for label in ("Refresh", "Buy lifetime access"):
            button = self.driver.find_element(By.XPATH, f"//main//button[normalize-space(.)='{label}']")
            self.assertTrue(button.is_displayed())
            self.assertTrue(button.is_enabled())
        self.assertFalse(self.driver.find_elements(By.CSS_SELECTOR, "main .card"))

    def test_e02_account_requires_login(self):
        email = f"license-{generate_random_string(12)}@integrationtests.com"
        password = generate_random_string(24)
        account = self.api.create_account(email, password)

        self.driver.get(f"{app_base_url}/account")
        login_form = self.wait.until(expected_conditions.visibility_of_element_located(
            (By.ID, "form-login")
        ))
        self.assertFalse(self.driver.find_elements(By.CSS_SELECTOR, "main time"))
        login_form.find_element(By.ID, "input-login-email").send_keys(email)
        login_form.find_element(By.ID, "input-login-password").send_keys(password)
        login_form.find_element(By.ID, "submit-button-login").click()

        self.wait.until(expected_conditions.text_to_be_present_in_element(
            (By.CSS_SELECTOR, "main h1"), "Account"
        ))
        license_heading = self.wait.until(expected_conditions.visibility_of_element_located(
            (By.CSS_SELECTOR, 'section[aria-labelledby="license-heading"] h3')
        ))
        self.assertEqual(license_heading.text, "Trial")
        self.assertEqual(self.driver.execute_script(
            "return JSON.parse(localStorage.getItem('account')).id;"
        ), account["id"])
        self.assert_displayed_license_dates(account["license"])

    def test_e03_trial_survives_new_browser_session(self):
        email, password = self.create_trial_account()
        self.open_account()
        account = self.read_account(email, password)
        self.assert_displayed_license_dates(account["license"])

        self.driver.quit()
        self.browsers.remove(self.driver)
        self.start_browser()
        self.driver.get(app_base_url)
        login_form = self.wait.until(expected_conditions.visibility_of_element_located(
            (By.ID, "form-login")
        ))
        self.assertIsNone(self.driver.execute_script("return localStorage.getItem('account');"))
        login_form.find_element(By.ID, "input-login-email").send_keys(email)
        login_form.find_element(By.ID, "input-login-password").send_keys(password)
        login_form.find_element(By.ID, "submit-button-login").click()
        self.wait.until(expected_conditions.visibility_of_element_located(
            (By.ID, "page-index")
        ))
        self.assertEqual(self.open_account().text, "Trial")
        self.assertEqual(self.driver.execute_script(
            "return JSON.parse(localStorage.getItem('account')).id;"
        ), account["id"])
        self.assert_displayed_license_dates(account["license"])
        self.assertEqual(self.read_account(email, password), account)
