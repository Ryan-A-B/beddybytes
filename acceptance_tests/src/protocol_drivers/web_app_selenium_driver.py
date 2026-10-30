import os
from typing import Iterator
from contextlib import contextmanager

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as conditions
from selenium.webdriver.support.ui import Select
from selenium.webdriver.support.wait import WebDriverWait
from selenium.common.exceptions import TimeoutException, StaleElementReferenceException

from protocol.web_app import LicenseInfo, TrialDetail
from utils import DefaultTimeoutSeconds

class WebAppSeleniumDriver:
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

    def open_baby_station(self) -> None:
        self.driver.find_element(By.ID, "nav-link-baby").click()

    def approve_baby_station_media_access(self) -> None:
        continue_button = self.wait.until(lambda driver: driver.find_element(By.ID, "button-continue-media-stream-permission-check"))
        continue_button.click()

    def get_baby_station_camera_list(self) -> list[str]:
        def available_camera_ids(driver):
            options = Select(driver.find_element(By.ID, "select-video-device")).options
            return [camera_id for option in options if (camera_id := option.get_attribute("value"))]

        return self.wait.until(available_camera_ids)

    def pick_baby_station_camera(self, camera_name: str) -> None:
        select_video_device_element = self.wait.until(lambda driver: driver.find_element(By.ID, "select-video-device"))
        select_video_device = Select(select_video_device_element)
        select_video_device.select_by_value(camera_name)
        self.wait.until(lambda driver: driver.find_element(By.ID, "select-video-device").get_attribute("value") == camera_name)
        self.wait.until(conditions.presence_of_element_located((By.CSS_SELECTOR, ".baby-station .video-container canvas")))

    def stop_baby_station_session(self) -> None:
        def stop_button(driver):
            try:
                session_toggle = driver.find_element(By.ID, "session-toggle")
                if session_toggle.text.strip() == "Stop" and session_toggle.is_displayed() and session_toggle.is_enabled():
                    return session_toggle
            except StaleElementReferenceException:
                pass
            return False

        self.wait.until(stop_button).click()
        self.wait.until(conditions.text_to_be_present_in_element((By.ID, "session-toggle"), "Start"))

    def baby_station_start_disabled(self) -> bool:
        def start_is_disabled(driver):
            try:
                session_toggle = driver.find_element(By.ID, "session-toggle")
                return session_toggle.text.strip() == "Start" and session_toggle.is_displayed() and not session_toggle.is_enabled()
            except StaleElementReferenceException:
                return False

        try:
            return self.wait.until(start_is_disabled)
        except TimeoutException:
            return False

    def start_baby_station(self) -> None:
        self.driver.find_element(By.ID, "nav-link-baby").click()
        session_toggle = self.wait.until(conditions.element_to_be_clickable((By.ID, "session-toggle")))
        session_toggle.click()
        self.wait.until(lambda driver: driver.find_element(By.ID, "session-toggle").text.strip() == "Stop")

    def start_parent_station(self) -> None:
        self.driver.find_element(By.ID, "nav-link-parent").click()

    def wait_for_parent_station_to_connect(self) -> None:
        self.wait.until(self._parent_station_media_is_advancing())

    def session_active_in_parent_station(self) -> bool:
        try:
            self.wait.until(self._parent_station_media_is_advancing())
            return True
        except TimeoutException:
            return False

    @staticmethod
    def _parent_station_media_is_advancing():
        baseline = None

        def media_is_advancing(driver):
            nonlocal baseline
            sample = driver.execute_script("""
                const video = document.getElementById('video-parent-station');
                const stream = video?.srcObject;
                if (!stream || !stream.active || !video.dataset.sessionId ||
                    video.paused || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return null;
                const tracks = stream.getTracks();
                if (!tracks.length || tracks.some(track => track.readyState !== 'live' || track.muted)) return null;
                return {
                    session_id: video.dataset.sessionId,
                    current_time: video.currentTime,
                    video_frames: stream.getVideoTracks().length ? video.getVideoPlaybackQuality().totalVideoFrames : null,
                };
            """)
            if sample is None:
                baseline = None
                return False
            if baseline is None:
                baseline = sample
                return False
            return (
                sample['session_id'] == baseline['session_id']
                and sample['current_time'] > baseline['current_time']
                and (baseline['video_frames'] is None or sample['video_frames'] > baseline['video_frames'])
            )

        return media_is_advancing

class WebAppSeleniumDriverFactory:
    @contextmanager
    def create(self) -> Iterator[WebAppSeleniumDriver]:
        with webdriver.Remote(
            command_executor=hub_url,
            options=chrome_options,
        ) as driver:
            driver.get(app_base_url)
            yield WebAppSeleniumDriver(driver)

# Selenium WebDriver configuration for Chrome

hub_url = os.getenv('SELENIUM_HUB_URL', 'http://localhost:4444')
app_base_url = 'https://app.beddybytes.local'

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

def wait_for_element_to_be_displayed(driver, wait, element_id, timeout=DefaultTimeoutSeconds):
    def is_displayed(driver):
        elements = driver.find_elements(By.ID, element_id)
        if len(elements) == 0:
            return False
        try:
            return elements[0].is_displayed()
        except StaleElementReferenceException:
            return False
    return wait.until(is_displayed)
