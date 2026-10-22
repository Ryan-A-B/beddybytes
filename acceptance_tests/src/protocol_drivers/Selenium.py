from selenium.webdriver.common.by import By
from selenium.webdriver.support.wait import WebDriverWait

from dsl.WebApp import LicenseInfo
from utils import DefaultTimeoutSeconds


class SeleniumWebApp:
    def __init__(self, driver):
        self.driver = driver
        self.wait = WebDriverWait(self.driver, timeout=DefaultTimeoutSeconds)

    def create_account(self, email: str, password: str) -> None:

        nav_button_create_account = self.wait.until(lambda driver: driver.find_element(By.ID, "nav-button-create-account"))
        nav_button_create_account.click()

        form_element = self.wait.until(lambda driver: driver.find_element(By.ID, "form-create-account"))

        email_input_element = form_element.find_element(By.ID, "input-create-account-email")
        email_input_element.send_keys(email)

        password_input_element = form_element.find_element(By.ID, "input-create-account-password")
        password_input_element.send_keys(password)

        submit_button_element = form_element.find_element(By.ID, "submit-button-create-account")
        submit_button_element.click()

        self.wait.until(lambda driver: driver.find_element(By.ID, "page-index"))

    def login(self, email: str, password: str) -> None:
        form_element = self.wait.until(lambda driver: driver.find_element(By.ID, "form-login"))

        email_input_element = form_element.find_element(By.ID, "input-login-email")
        email_input_element.send_keys(email)

        password_input_element = form_element.find_element(By.ID, "input-login-password")
        password_input_element.send_keys(password)

        submit_button_element = form_element.find_element(By.ID, "submit-button-login")
        submit_button_element.click()

        self.wait.until(lambda driver: driver.find_element(By.ID, "page-index"))

    def get_license_info(self) -> LicenseInfo:
        self.driver.find_element(By.ID, "nav-link-account").click()
        license_info_section = self.wait.until(lambda driver: driver.find_element(By.ID, "section-license-info"))
        license_type_element = license_info_section.find_element(By.ID, "license-type")
        license_type = license_type_element.get_attribute("data-license-type")
        license_start_element = license_info_section.find_element(By.ID, "license-start")
        license_start_unix_timestamp = int(license_start_element.get_attribute("data-license-start"))
        license_info = LicenseInfo(
            license_type=license_type,
            start_unix_timestamp=license_start_unix_timestamp,
        )
        if license_type == "trial":
            license_end_element = license_info_section.find_element(By.ID, "license-end")
            license_end_unix_timestamp = int(license_end_element.get_attribute("data-license-end"))
            license_info.end_unix_timestamp = license_end_unix_timestamp
        return license_info
