
import unittest
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.wait import WebDriverWait
from selenium.common.exceptions import NoSuchElementException

from settings import hub_url, app_base_url, chrome_options
from utils import create_account, generate_random_string

class CreateAccountTest(unittest.TestCase):
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
