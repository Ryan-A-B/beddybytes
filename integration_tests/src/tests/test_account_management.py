import unittest
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.wait import WebDriverWait
from selenium.common.exceptions import NoSuchElementException

from settings import hub_url, app_base_url, chrome_options
from utils import create_account, generate_random_string, get_input

class TestAccountManagement(unittest.TestCase):
    def setUp(self):
        pass

    def tearDown(self):
        pass

    def test_create_account(self):
        email = f'{generate_random_string(10)}@integrationtests.com'
        password = generate_random_string(20)

        with webdriver.Remote(command_executor=hub_url, options=chrome_options) as driver:
            driver.get(f"{app_base_url}#create_account")

            wait = WebDriverWait(driver, timeout=1)

            form_element = wait.until(lambda driver: driver.find_element(By.ID, "form-create-account"))
            self.assertTrue(form_element.is_displayed())

            email_input_element = form_element.find_element(By.ID, "input-create-account-email")
            self.assertTrue(email_input_element.is_displayed())
            email_input_element.send_keys(email)

            password_input_element = form_element.find_element(By.ID, "input-create-account-password")
            self.assertTrue(password_input_element.is_displayed())
            password_input_element.send_keys(password)

            submit_button_element = form_element.find_element(By.ID, "submit-button-create-account")
            self.assertTrue(submit_button_element.is_displayed())
            submit_button_element.click()

            index_page_root_element = wait.until(lambda driver: driver.find_element(By.ID, "page-index"))
            self.assertTrue(index_page_root_element.is_displayed())
            with self.assertRaises(NoSuchElementException):
                driver.find_element(By.ID, "container-errors")

    def test_login(self):
        email = f'{generate_random_string(10)}@integrationtests.com'
        password = generate_random_string(20)

        with webdriver.Remote(command_executor=hub_url, options=chrome_options) as driver:
            driver.get(f"{app_base_url}")
            create_account(driver, email, password)
        
        with webdriver.Remote(command_executor=hub_url, options=chrome_options) as driver:
            driver.get(f"{app_base_url}")

            wait = WebDriverWait(driver, timeout=1)

            form_element = wait.until(lambda driver: driver.find_element(By.ID, "form-login"))
            self.assertTrue(form_element.is_displayed())

            email_input_element = form_element.find_element(By.ID, "input-login-email")
            self.assertTrue(email_input_element.is_displayed())
            email_input_element.send_keys(email)

            password_input_element = form_element.find_element(By.ID, "input-login-password")
            self.assertTrue(password_input_element.is_displayed())
            password_input_element.send_keys(password)

            submit_button_element = form_element.find_element(By.ID, "submit-button-login")
            self.assertTrue(submit_button_element.is_displayed())
            submit_button_element.click()

            index_page_root_element = wait.until(lambda driver: driver.find_element(By.ID, "page-index"))
            self.assertTrue(index_page_root_element.is_displayed())
            with self.assertRaises(NoSuchElementException):
                driver.find_element(By.ID, "container-errors")

    def test_reset_password(self):
        email = f'{generate_random_string(10)}@integrationtests.com'
        password = generate_random_string(20)
        new_password = generate_random_string(20)

        # Create account
        with webdriver.Remote(command_executor=hub_url, options=chrome_options) as driver:
            driver.get(f"{app_base_url}#create_account")
            wait = WebDriverWait(driver, timeout=1)
            form_element = wait.until(lambda driver: driver.find_element(By.ID, "form-create-account"))
            email_input_element = form_element.find_element(By.ID, "input-create-account-email")
            email_input_element.send_keys(email)
            password_input_element = form_element.find_element(By.ID, "input-create-account-password")
            password_input_element.send_keys(password)
            submit_button_element = form_element.find_element(By.ID, "submit-button-create-account")
            submit_button_element.click()
            wait.until(lambda driver: driver.find_element(By.ID, "page-index"))

        # Request password reset
        with webdriver.Remote(command_executor=hub_url, options=chrome_options) as driver:
            driver.get(f"{app_base_url}")
            wait = WebDriverWait(driver, timeout=1)
            form_element = wait.until(lambda driver: driver.find_element(By.ID, "form-login"))
            link_element = form_element.find_element(By.ID, "link-login-request-password-reset")
            link_element.click()
            form_element = wait.until(lambda driver: driver.find_element(By.ID, "form-request-password-reset"))
            email_input_element = form_element.find_element(By.ID, "input-request-password-reset-email")
            email_input_element.send_keys(email)
            submit_button_element = form_element.find_element(By.ID, "submit-button-request-password-reset")
            submit_button_element.click()

        # Wait for reset link
        reset_link = get_input("Please enter the reset link: ", timeout=60)
        if not reset_link:
            print("Reset link not provided. Skipping test.")
            return

        # Reset password
        with webdriver.Remote(command_executor=hub_url, options=chrome_options) as driver:
            driver.get(reset_link)
            wait = WebDriverWait(driver, timeout=1)
            form_element = wait.until(lambda driver: driver.find_element(By.ID, "form-reset-password"))
            password_input_element = form_element.find_element(By.ID, "input-reset-password-password")
            password_input_element.send_keys(new_password)
            submit_button_element = form_element.find_element(By.ID, "submit-button-reset-password")
            submit_button_element.click()

        # Attempt to login with old password
        with webdriver.Remote(command_executor=hub_url, options=chrome_options) as driver:
            driver.get(f"{app_base_url}")
            wait = WebDriverWait(driver, timeout=1)
            form_element = wait.until(lambda driver: driver.find_element(By.ID, "form-login"))
            email_input_element = form_element.find_element(By.ID, "input-login-email")
            email_input_element.send_keys(email)
            password_input_element = form_element.find_element(By.ID, "input-login-password")
            password_input_element.send_keys(password)
            submit_button_element = form_element.find_element(By.ID, "submit-button-login")
            submit_button_element.click()
            alert_element = wait.until(lambda driver: driver.find_element(By.CSS_SELECTOR, "div.alert"))
            self.assertTrue(alert_element.is_displayed())
            self.assertIn("Failed to login:", alert_element.text)

        # Login with new password
        with webdriver.Remote(command_executor=hub_url, options=chrome_options) as driver:
            driver.get(f"{app_base_url}")
            wait = WebDriverWait(driver, timeout=1)
            form_element = wait.until(lambda driver: driver.find_element(By.ID, "form-login"))
            email_input_element = form_element.find_element(By.ID, "input-login-email")
            email_input_element.send_keys(email)
            password_input_element = form_element.find_element(By.ID, "input-login-password")
            password_input_element.send_keys(new_password)
            submit_button_element = form_element.find_element(By.ID, "submit-button-login")
            submit_button_element.click()
            wait.until(lambda driver: driver.find_element(By.ID, "page-index"))
            with self.assertRaises(NoSuchElementException):
                driver.find_element(By.ID, "container-errors")
