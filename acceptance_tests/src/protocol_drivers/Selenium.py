import os

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.wait import WebDriverWait
from selenium.webdriver.support import expected_conditions as conditions
from selenium.common.exceptions import TimeoutException

from dsl.WebApp import LicenseInfo, TrialDetail
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

    def trial_expired_banner_is_displayed(self) -> bool:
        try:
            self.wait.until(conditions.visibility_of_element_located((By.ID, "trial-expired-banner")))
            return True
        except TimeoutException:
            return False

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
            license_info.trial_detail = TrialDetail(
                end_unix_timestamp=license_end_unix_timestamp
            )
        return license_info


# Selenium WebDriver configuration for Chrome

hub_url = os.getenv('SELENIUM_HUB_URL', 'http://localhost:4444')
app_base_url = 'https://app.beddybytes.local'
api_base_url = os.getenv('API_BASE_URL', 'https://api.beddybytes.local')
api_websocket_base_url = os.getenv('API_WEBSOCKET_BASE_URL', 'wss://api.beddybytes.local')

chrome_options = webdriver.ChromeOptions()
# allow self-signed certificates
chrome_options.add_argument("--ignore-certificate-errors")
# Recommended by https://webrtc.org/getting-started/testing
chrome_options.add_argument("--allow-file-access-from-files")
chrome_options.add_argument("--disable-translate")
chrome_options.add_argument("--use-fake-ui-for-media-stream")
chrome_options.add_argument("--use-fake-device-for-media-stream")
chrome_options.add_argument("--mute-audio")
# --use-file-for-fake-audio-capture=<filename> - Provide a file to use when capturing audio.
# --use-file-for-fake-video-capture=<filename> - Provide a file to use when capturing video.