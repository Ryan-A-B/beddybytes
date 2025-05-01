import unittest
import time

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.wait import WebDriverWait
from selenium.webdriver.support.ui import Select
from selenium.common.exceptions import NoSuchElementException

from settings import hub_url, app_base_url, chrome_options
from utils import create_account, login, generate_random_string

class TestRecording(unittest.TestCase):
    def setUp(self):
        pass

    def tearDown(self):
        pass

    def allow_time_for_video_to_display(self):
        time.sleep(0.5)

    def test_start_and_stop(self):
        email = f'{generate_random_string(10)}@integrationtests.com'
        password = generate_random_string(20)

        with webdriver.Remote(command_executor=hub_url, options=chrome_options) as baby_station_driver, webdriver.Remote(command_executor=hub_url, options=chrome_options) as parent_station_driver:
            baby_station_driver.get(f"{app_base_url}")
            create_account(baby_station_driver, email, password)
            baby_station_driver.find_element(By.ID, "nav-link-baby").click()
            baby_station_driver_wait = WebDriverWait(baby_station_driver, 1)
            continue_button = baby_station_driver_wait.until(lambda driver: driver.find_element(By.ID, "button-continue-media-stream-permission-check"))
            continue_button.click()
            select_video_device = baby_station_driver_wait.until(lambda driver: Select(driver.find_element(By.ID, "select-video-device")))
            select_video_device.options[1].click()
            session_toggle = baby_station_driver_wait.until(lambda driver: driver.find_element(By.ID, "session-toggle"))
            session_toggle.click()

            parent_station_driver.get(f"{app_base_url}")
            login(parent_station_driver, email, password)
            parent_station_driver.find_element(By.ID, "nav-link-parent").click()

            parent_station_driver_wait = WebDriverWait(parent_station_driver, 1)
            self.allow_time_for_video_to_display()

            start_recording_button = parent_station_driver_wait.until(lambda driver: driver.find_element(By.ID, "button-start-recording"))
            self.assertTrue(start_recording_button.is_displayed())
            start_recording_button.click()

            stop_recording_button = parent_station_driver_wait.until(lambda driver: driver.find_element(By.ID, "button-stop-recording"))
            self.assertTrue(stop_recording_button.is_displayed())
            stop_recording_button.click()

            start_recording_button = parent_station_driver_wait.until(lambda driver: driver.find_element(By.ID, "button-start-recording"))
            self.assertTrue(start_recording_button.is_displayed())
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
            baby_station_driver_wait = WebDriverWait(baby_station_driver, 1)
            continue_button = baby_station_driver_wait.until(lambda driver: driver.find_element(By.ID, "button-continue-media-stream-permission-check"))
            continue_button.click()
            select_video_device = baby_station_driver_wait.until(lambda driver: Select(driver.find_element(By.ID, "select-video-device")))
            select_video_device.options[1].click()
            session_toggle = baby_station_driver_wait.until(lambda driver: driver.find_element(By.ID, "session-toggle"))
            session_toggle.click()

            parent_station_driver.get(f"{app_base_url}")
            login(parent_station_driver, email, password)
            parent_station_driver.find_element(By.ID, "nav-link-parent").click()

            parent_station_driver_wait = WebDriverWait(parent_station_driver, 1)
            self.allow_time_for_video_to_display()

            start_recording_button = parent_station_driver_wait.until(lambda driver: driver.find_element(By.ID, "button-start-recording"))
            self.assertTrue(start_recording_button.is_displayed())
            start_recording_button.click()

            # Baby station ends the session
            session_toggle.click()

            # Baby station starts a new session
            session_toggle.click()

            # Parent station joins the new session
            self.allow_time_for_video_to_display()

            # Ensure parent station is showing the button to start recording
            start_recording_button = parent_station_driver_wait.until(lambda driver: driver.find_element(By.ID, "button-start-recording"))
            self.assertTrue(start_recording_button.is_displayed())
            with self.assertRaises(NoSuchElementException):
                parent_station_driver.find_element(By.ID, "container-errors")

