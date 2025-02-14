import unittest
import time

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.wait import WebDriverWait
from selenium.webdriver.support.ui import Select
from selenium.common.exceptions import NoSuchElementException

from settings import hub_url, app_base_url, chrome_options
from utils import create_account, login, get_browser_logs, generate_random_string, stop_backend_container, start_backend_container

class TestSession(unittest.TestCase):
    def setUp(self):
        pass

    def tearDown(self):
        pass

    def allow_time_for_video_to_display(self):
        time.sleep(0.1)

    def test_audio_session(self):
        email = f'{generate_random_string(10)}@integrationtests.com'
        password = generate_random_string(20)

        with webdriver.Remote(command_executor=hub_url, options=chrome_options) as driver_1, webdriver.Remote(command_executor=hub_url, options=chrome_options) as driver_2:
            driver_1.get(f"{app_base_url}")
            create_account(driver_1, email, password)
            driver_1.find_element(By.ID, "nav-link-baby").click()
            driver_1_wait = WebDriverWait(driver_1, 1)
            continue_button = driver_1_wait.until(lambda driver: driver.find_element(By.ID, "button-continue-media-stream-permission-check"))
            continue_button.click()
            session_toggle = driver_1_wait.until(lambda driver: driver.find_element(By.ID, "session-toggle"))
            session_toggle.click()

            driver_2.get(f"{app_base_url}")
            login(driver_2, email, password)
            driver_2.find_element(By.ID, "nav-link-parent").click()

            driver_2_wait = WebDriverWait(driver_2, 1)
            session_dropdown_element = driver_2_wait.until(lambda driver: driver.find_element(By.ID, "session-dropdown"))
            session_dropdown = Select(session_dropdown_element)
            self.assertEqual(len(session_dropdown.options), 2)
            self.assertEqual(session_dropdown.options[0].get_attribute("value"), "")
            self.assertNotEqual(session_dropdown.options[1].get_attribute("value"), "")

            session_dropdown.options[1].click()

            driver_2_wait = WebDriverWait(driver_2, 1)
            audio_only_message = driver_2_wait.until(lambda driver: driver.find_element(By.ID, "audio-only-message"))
            self.assertTrue(audio_only_message.is_displayed())

            video_element = driver_2_wait.until(lambda driver: driver.find_element(By.ID, "video-parent-station"))
            self.assertFalse(video_element.is_displayed())

            session_toggle.click()
            alert_session_ended = driver_2_wait.until(lambda driver: driver.find_element(By.ID, "alert-session-ended"))
            self.assertTrue(alert_session_ended.is_displayed())

            driver_1_logs = get_browser_logs(driver_1)
            driver_2_logs = get_browser_logs(driver_2)
            self.assertEqual(len(driver_1_logs), 0)
            self.assertEqual(len(driver_2_logs), 0)
            
    def test_video_session(self):
        email = f'{generate_random_string(10)}@integrationtests.com'
        password = generate_random_string(20)

        with webdriver.Remote(command_executor=hub_url, options=chrome_options) as driver_1, webdriver.Remote(command_executor=hub_url, options=chrome_options) as driver_2:
            driver_1.get(f"{app_base_url}")
            create_account(driver_1, email, password)
            driver_1.find_element(By.ID, "nav-link-baby").click()
            driver_1_wait = WebDriverWait(driver_1, 1)
            continue_button = driver_1_wait.until(lambda driver: driver.find_element(By.ID, "button-continue-media-stream-permission-check"))
            continue_button.click()
            select_video_device_element = driver_1_wait.until(lambda driver: driver.find_element(By.ID, "select-video-device"))
            self.assertTrue(select_video_device_element.is_displayed())
            select_video_device = Select(select_video_device_element)
            self.assertTrue(len(select_video_device.options) > 0)
            select_video_device.options[1].click()

            session_toggle = driver_1_wait.until(lambda driver: driver.find_element(By.ID, "session-toggle"))
            session_toggle.click()

            driver_2.get(f"{app_base_url}")
            login(driver_2, email, password)
            driver_2.find_element(By.ID, "nav-link-parent").click()

            driver_2_wait = WebDriverWait(driver_2, 1)
            video_element = driver_2_wait.until(lambda driver: driver.find_element(By.ID, "video-parent-station"))
            session_dropdown_element = driver_2_wait.until(lambda driver: driver.find_element(By.ID, "session-dropdown"))
            session_dropdown = Select(session_dropdown_element)
            self.assertEqual(len(session_dropdown.options), 2)
            self.assertEqual(session_dropdown.options[0].get_attribute("value"), "")
            self.assertNotEqual(session_dropdown.options[1].get_attribute("value"), "")
            session_dropdown.options[1].click()
            self.allow_time_for_video_to_display()
            self.assertTrue(video_element.is_displayed())

            session_toggle.click()
            alert_session_ended = driver_2_wait.until(lambda driver: driver.find_element(By.ID, "alert-session-ended"))
            self.assertTrue(alert_session_ended.is_displayed())
            self.assertFalse(video_element.is_displayed())

            driver_1_logs = get_browser_logs(driver_1)
            driver_2_logs = get_browser_logs(driver_2)
            self.assertEqual(len(driver_1_logs), 0)
            self.assertEqual(len(driver_2_logs), 0)

    def test_restart_and_reconnect_session(self):
        email = f'{generate_random_string(10)}@integrationtests.com'
        password = generate_random_string(20)

        with webdriver.Remote(command_executor=hub_url, options=chrome_options) as driver_1, webdriver.Remote(command_executor=hub_url, options=chrome_options) as driver_2:
            driver_1.get(f"{app_base_url}")
            create_account(driver_1, email, password)
            driver_1.find_element(By.ID, "nav-link-baby").click()
            driver_1_wait = WebDriverWait(driver_1, 1)
            continue_button = driver_1_wait.until(lambda driver: driver.find_element(By.ID, "button-continue-media-stream-permission-check"))
            continue_button.click()
            select_video_device = driver_1_wait.until(lambda driver: Select(driver.find_element(By.ID, "select-video-device")))
            select_video_device.options[1].click()
            session_toggle = driver_1_wait.until(lambda driver: driver.find_element(By.ID, "session-toggle"))
            session_toggle.click()

            driver_2.get(f"{app_base_url}")
            login(driver_2, email, password)
            driver_2.find_element(By.ID, "nav-link-parent").click()

            driver_2_wait = WebDriverWait(driver_2, 1)
            video_element = driver_2_wait.until(lambda driver: driver.find_element(By.ID, "video-parent-station"))
            session_dropdown_element = driver_2_wait.until(lambda driver: driver.find_element(By.ID, "session-dropdown"))
            session_dropdown = Select(session_dropdown_element)
            session_dropdown.options[1].click()
            self.allow_time_for_video_to_display()
            self.assertTrue(video_element.is_displayed())

            session_toggle.click()
            alert_session_ended = driver_2_wait.until(lambda driver: driver.find_element(By.ID, "alert-session-ended"))
            self.assertTrue(alert_session_ended.is_displayed())
            self.assertFalse(video_element.is_displayed())

            session_toggle.click()
            session_dropdown_element = driver_2_wait.until(lambda driver: driver.find_element(By.ID, "session-dropdown"))
            session_dropdown = Select(session_dropdown_element)
            self.assertEqual(len(session_dropdown.options), 2)
            self.assertEqual(session_dropdown.options[0].get_attribute("value"), "")
            self.assertNotEqual(session_dropdown.options[1].get_attribute("value"), "")
            session_dropdown.options[1].click()
            self.allow_time_for_video_to_display()
            self.assertTrue(video_element.is_displayed())

            driver_1_logs = get_browser_logs(driver_1)
            self.assertEqual(len(driver_1_logs), 0)
            driver_2_logs = get_browser_logs(driver_2)
            self.assertEqual(len(driver_2_logs), 0)

    def test_connect_multiple_parent_stations(self):
        email = f'{generate_random_string(10)}@integrationtests.com'
        password = generate_random_string(20)

        with webdriver.Remote(command_executor=hub_url, options=chrome_options) as driver_1, webdriver.Remote(command_executor=hub_url, options=chrome_options) as driver_2, webdriver.Remote(command_executor=hub_url, options=chrome_options) as driver_3:
            driver_1.get(f"{app_base_url}")
            create_account(driver_1, email, password)
            driver_1.find_element(By.ID, "nav-link-baby").click()
            driver_1_wait = WebDriverWait(driver_1, 1)
            continue_button = driver_1_wait.until(lambda driver: driver.find_element(By.ID, "button-continue-media-stream-permission-check"))
            continue_button.click()
            select_video_device = driver_1_wait.until(lambda driver: Select(driver.find_element(By.ID, "select-video-device")))
            select_video_device.options[1].click()
            session_toggle = driver_1_wait.until(lambda driver: driver.find_element(By.ID, "session-toggle"))
            session_toggle.click()

            driver_2.get(f"{app_base_url}")
            login(driver_2, email, password)
            driver_2.find_element(By.ID, "nav-link-parent").click()

            driver_2_wait = WebDriverWait(driver_2, 1)
            session_dropdown_element = driver_2_wait.until(lambda driver: driver.find_element(By.ID, "session-dropdown"))
            session_dropdown = Select(session_dropdown_element)
            self.assertEqual(len(session_dropdown.options), 2)
            self.assertEqual(session_dropdown.options[0].get_attribute("value"), "")
            self.assertNotEqual(session_dropdown.options[1].get_attribute("value"), "")
            session_dropdown.options[1].click()

            driver_3.get(f"{app_base_url}")
            login(driver_3, email, password)
            driver_3.find_element(By.ID, "nav-link-parent").click()

            driver_3_wait = WebDriverWait(driver_3, 1)
            session_dropdown_element = driver_3_wait.until(lambda driver: driver.find_element(By.ID, "session-dropdown"))
            session_dropdown = Select(session_dropdown_element)
            self.assertEqual(len(session_dropdown.options), 2)
            self.assertEqual(session_dropdown.options[0].get_attribute("value"), "")
            self.assertNotEqual(session_dropdown.options[1].get_attribute("value"), "")
            session_dropdown.options[1].click()

            driver_2_video_element = driver_2_wait.until(lambda driver: driver.find_element(By.ID, "video-parent-station"))
            self.assertTrue(driver_2_video_element.is_displayed())
            driver_3_video_element = driver_3_wait.until(lambda driver: driver.find_element(By.ID, "video-parent-station"))
            self.assertTrue(driver_3_video_element.is_displayed())

            driver_1_logs = get_browser_logs(driver_1)
            self.assertEqual(len(driver_1_logs), 0)
            driver_2_logs = get_browser_logs(driver_2)
            self.assertEqual(len(driver_2_logs), 0)
            driver_3_logs = get_browser_logs(driver_3)
            self.assertEqual(len(driver_3_logs), 0)

    def test_parent_station_switching_between_baby_stations(self):
        email = f'{generate_random_string(10)}@integrationtests.com'
        password = generate_random_string(20)

        with webdriver.Remote(command_executor=hub_url, options=chrome_options) as driver_1, webdriver.Remote(command_executor=hub_url, options=chrome_options) as driver_2, webdriver.Remote(command_executor=hub_url, options=chrome_options) as driver_3:
            driver_1.get(f"{app_base_url}")
            create_account(driver_1, email, password)
            driver_1.find_element(By.ID, "nav-link-baby").click()
            driver_1_wait = WebDriverWait(driver_1, 1)
            continue_button = driver_1_wait.until(lambda driver: driver.find_element(By.ID, "button-continue-media-stream-permission-check"))
            continue_button.click()
            select_video_device = driver_1_wait.until(lambda driver: Select(driver.find_element(By.ID, "select-video-device")))
            select_video_device.options[1].click()
            session_toggle = driver_1_wait.until(lambda driver: driver.find_element(By.ID, "session-toggle"))
            session_toggle.click()

            driver_2.get(f"{app_base_url}")
            login(driver_2, email, password)
            driver_2.find_element(By.ID, "nav-link-baby").click()
            driver_2_wait = WebDriverWait(driver_2, 1)
            continue_button = driver_2_wait.until(lambda driver: driver.find_element(By.ID, "button-continue-media-stream-permission-check"))
            continue_button.click()
            select_video_device = driver_2_wait.until(lambda driver: Select(driver.find_element(By.ID, "select-video-device")))
            select_video_device.options[1].click()
            session_toggle = driver_2_wait.until(lambda driver: driver.find_element(By.ID, "session-toggle"))
            session_toggle.click()

            driver_3.get(f"{app_base_url}")
            login(driver_3, email, password)
            driver_3.find_element(By.ID, "nav-link-parent").click()

            driver_3_wait = WebDriverWait(driver_3, 1)
            session_dropdown_element = driver_3_wait.until(lambda driver: driver.find_element(By.ID, "session-dropdown"))
            session_dropdown = Select(session_dropdown_element)
            self.assertEqual(len(session_dropdown.options), 3)
            self.assertEqual(session_dropdown.options[0].get_attribute("value"), "")
            self.assertNotEqual(session_dropdown.options[1].get_attribute("value"), "")
            self.assertNotEqual(session_dropdown.options[2].get_attribute("value"), "")

            video_element = driver_3_wait.until(lambda driver: driver.find_element(By.ID, "video-parent-station"))
            session_dropdown.options[1].click()
            self.allow_time_for_video_to_display()
            self.assertTrue(video_element.is_displayed())

            session_dropdown.options[2].click()
            self.allow_time_for_video_to_display()
            self.assertTrue(video_element.is_displayed())

            session_dropdown.options[0].click()
            self.assertFalse(video_element.is_displayed())

            session_dropdown.options[1].click()
            self.allow_time_for_video_to_display()
            self.assertTrue(video_element.is_displayed())

            driver_1_logs = get_browser_logs(driver_1)
            self.assertEqual(len(driver_1_logs), 0)
            driver_2_logs = get_browser_logs(driver_2)
            self.assertEqual(len(driver_2_logs), 0)
            driver_3_logs = get_browser_logs(driver_3)
            self.assertEqual(len(driver_3_logs), 0)

    def test_reconnect_after_server_restarts(self):
        email = f'{generate_random_string(10)}@integrationtests.com'
        password = generate_random_string(20)

        with webdriver.Remote(command_executor=hub_url, options=chrome_options) as driver_1, webdriver.Remote(command_executor=hub_url, options=chrome_options) as driver_2:
            driver_1.get(f"{app_base_url}")
            create_account(driver_1, email, password)
            driver_1.find_element(By.ID, "nav-link-baby").click()
            driver_1_wait = WebDriverWait(driver_1, 1)
            continue_button = driver_1_wait.until(lambda driver: driver.find_element(By.ID, "button-continue-media-stream-permission-check"))
            continue_button.click()
            select_video_device = driver_1_wait.until(lambda driver: Select(driver.find_element(By.ID, "select-video-device")))
            select_video_device.options[1].click()
            session_toggle = driver_1_wait.until(lambda driver: driver.find_element(By.ID, "session-toggle"))
            session_toggle.click()

            driver_2.get(f"{app_base_url}")
            login(driver_2, email, password)
            driver_2.find_element(By.ID, "nav-link-parent").click()

            driver_2_wait = WebDriverWait(driver_2, 1)
            video_element = driver_2_wait.until(lambda driver: driver.find_element(By.ID, "video-parent-station"))
            session_dropdown_element = driver_2_wait.until(lambda driver: driver.find_element(By.ID, "session-dropdown"))
            session_dropdown = Select(session_dropdown_element)
            self.assertEqual(len(session_dropdown.options), 2)
            self.assertEqual(session_dropdown.options[0].get_attribute("value"), "")
            self.assertNotEqual(session_dropdown.options[1].get_attribute("value"), "")
            session_dropdown.options[1].click()
            self.allow_time_for_video_to_display()
            self.assertTrue(video_element.is_displayed())

            stop_backend_container()
            for _ in range(5):
                time.sleep(1)
                self.assertTrue(video_element.is_displayed())
            start_backend_container()
            for _ in range(10):
                time.sleep(1)
                self.assertTrue(video_element.is_displayed())

            session_toggle.click()
            alert_session_ended = driver_2_wait.until(lambda driver: driver.find_element(By.ID, "alert-session-ended"))
            self.assertTrue(alert_session_ended.is_displayed())