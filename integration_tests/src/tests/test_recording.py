import unittest

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.wait import WebDriverWait
from selenium.common.exceptions import NoSuchElementException

from settings import hub_url, app_base_url, chrome_options
from utils import create_account, login, generate_random_string, select_first_video_device_and_wait_for_preview, wait_for_element_to_be_displayed, wait_for_parent_station_ready, wait_for_session_running

class TestRecording(unittest.TestCase):
    def setUp(self):
        pass

    def tearDown(self):
        pass

    def test_start_and_stop(self):
        email = f'{generate_random_string(10)}@integrationtests.com'
        password = generate_random_string(20)

        with webdriver.Remote(command_executor=hub_url, options=chrome_options) as baby_station_driver, webdriver.Remote(command_executor=hub_url, options=chrome_options) as parent_station_driver:
            baby_station_driver.get(f"{app_base_url}")
            create_account(baby_station_driver, email, password)
            baby_station_driver.find_element(By.ID, "nav-link-baby").click()
            baby_station_driver_wait = WebDriverWait(baby_station_driver, 5)
            continue_button = baby_station_driver_wait.until(lambda driver: driver.find_element(By.ID, "button-continue-media-stream-permission-check"))
            continue_button.click()
            select_first_video_device_and_wait_for_preview(baby_station_driver)
            session_toggle = baby_station_driver_wait.until(lambda driver: driver.find_element(By.ID, "session-toggle"))
            session_toggle.click()
            wait_for_session_running(baby_station_driver)

            parent_station_driver.get(f"{app_base_url}")
            login(parent_station_driver, email, password)
            parent_station_driver.find_element(By.ID, "nav-link-parent").click()

            parent_station_driver_wait = WebDriverWait(parent_station_driver, 5)
            wait_for_parent_station_ready(parent_station_driver)

            start_recording_button = parent_station_driver_wait.until(lambda driver: driver.find_element(By.ID, "button-start-recording"))
            wait_for_element_to_be_displayed(parent_station_driver, "button-start-recording")
            start_recording_button.click()

            stop_recording_button = parent_station_driver_wait.until(lambda driver: driver.find_element(By.ID, "button-stop-recording"))
            wait_for_element_to_be_displayed(parent_station_driver, "button-stop-recording")
            stop_recording_button.click()

            start_recording_button = parent_station_driver_wait.until(lambda driver: driver.find_element(By.ID, "button-start-recording"))
            wait_for_element_to_be_displayed(parent_station_driver, "button-start-recording")
            # TODO: Check that the recording is saved
            with self.assertRaises(NoSuchElementException):
                parent_station_driver.find_element(By.ID, "container-errors")

    def test_recording_stops_due_to_media_stream_ending(self):
        email = f'{generate_random_string(10)}@integrationtests.com'
        password = generate_random_string(20)

        with webdriver.Remote(command_executor=hub_url, options=chrome_options) as baby_station_driver, webdriver.Remote(command_executor=hub_url, options=chrome_options) as parent_station_driver:
            baby_station_driver.get(f"{app_base_url}")
            create_account(baby_station_driver, email, password)
            baby_station_driver.find_element(By.ID, "nav-link-baby").click()
            baby_station_driver_wait = WebDriverWait(baby_station_driver, 5)
            continue_button = baby_station_driver_wait.until(lambda driver: driver.find_element(By.ID, "button-continue-media-stream-permission-check"))
            continue_button.click()
            select_first_video_device_and_wait_for_preview(baby_station_driver)
            session_toggle = baby_station_driver_wait.until(lambda driver: driver.find_element(By.ID, "session-toggle"))
            session_toggle.click()
            wait_for_session_running(baby_station_driver)

            parent_station_driver.get(f"{app_base_url}")
            login(parent_station_driver, email, password)
            parent_station_driver.find_element(By.ID, "nav-link-parent").click()

            parent_station_driver_wait = WebDriverWait(parent_station_driver, 5)
            wait_for_parent_station_ready(parent_station_driver)

            start_recording_button = parent_station_driver_wait.until(lambda driver: driver.find_element(By.ID, "button-start-recording"))
            wait_for_element_to_be_displayed(parent_station_driver, "button-start-recording")
            start_recording_button.click()

            # Baby station ends the session
            session_toggle.click()

            # Baby station starts a new session
            session_toggle.click()
            wait_for_session_running(baby_station_driver)

            # Parent station joins the new session
            wait_for_parent_station_ready(parent_station_driver)

            # Ensure parent station is showing the button to start recording
            start_recording_button = parent_station_driver_wait.until(lambda driver: driver.find_element(By.ID, "button-start-recording"))
            wait_for_element_to_be_displayed(parent_station_driver, "button-start-recording")
            with self.assertRaises(NoSuchElementException):
                parent_station_driver.find_element(By.ID, "container-errors")
