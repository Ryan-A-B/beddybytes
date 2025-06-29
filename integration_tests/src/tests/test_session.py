import unittest
import time

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.wait import WebDriverWait
from selenium.webdriver.support.ui import Select

from settings import hub_url, app_base_url, chrome_options
from utils import create_account, login, get_browser_logs, generate_random_string, stop_backend_container, start_backend_container, wait_for_element_to_be_displayed, wait_for_element_to_be_removed, wait_for_element_to_not_be_displayed

class TestSession(unittest.TestCase):
    def setUp(self):
        pass

    def tearDown(self):
        pass

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

            session_name = generate_random_string(10)
            session_name_input = driver_1_wait.until(lambda driver: driver.find_element(By.ID, "input-session-name"))
            session_name_input.clear()
            session_name_input.send_keys(session_name)

            session_toggle = driver_1_wait.until(lambda driver: driver.find_element(By.ID, "session-toggle"))
            session_toggle.click()

            driver_2.get(f"{app_base_url}")
            login(driver_2, email, password)
            driver_2.find_element(By.ID, "nav-link-parent").click()

            driver_2_wait = WebDriverWait(driver_2, 1)
            wait_for_element_to_be_displayed(driver_2, "audio-only-message", 2)

            audio_only_message = driver_2_wait.until(lambda driver: driver.find_element(By.ID, "audio-only-message"))
            self.assertTrue(audio_only_message.is_displayed())

            video_element = driver_2_wait.until(lambda driver: driver.find_element(By.ID, "video-parent-station"))
            self.assertFalse(video_element.is_displayed())

            baby_station_dropdown_element = driver_2_wait.until(lambda driver: driver.find_element(By.ID, "baby-station-dropdown"))
            baby_station_dropdown = Select(baby_station_dropdown_element)
            self.assertEqual(len(baby_station_dropdown.options), 1)
            self.assertEqual(baby_station_dropdown.options[0].text, session_name)
            self.assertTrue(baby_station_dropdown.options[0].is_selected())

            session_toggle.click()
            wait_for_element_to_not_be_displayed(driver_2, "video-parent-station")
            wait_for_element_to_be_removed(driver_2, "audio-only-message")

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

            session_name = generate_random_string(10)
            session_name_input = driver_1_wait.until(lambda driver: driver.find_element(By.ID, "input-session-name"))
            session_name_input.clear()
            session_name_input.send_keys(session_name)

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
            wait_for_element_to_be_displayed(driver_2, "video-parent-station")

            baby_station_dropdown_element = driver_2_wait.until(lambda driver: driver.find_element(By.ID, "baby-station-dropdown"))
            baby_station_dropdown = Select(baby_station_dropdown_element)
            self.assertEqual(len(baby_station_dropdown.options), 1)
            self.assertEqual(baby_station_dropdown.options[0].text, session_name)
            self.assertTrue(baby_station_dropdown.options[0].is_selected())

            session_toggle.click()
            wait_for_element_to_not_be_displayed(driver_2, "video-parent-station")

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
            wait_for_element_to_be_displayed(driver_2, "video-parent-station")

            session_toggle.click()
            driver_2_wait.until(lambda driver: driver.find_element(By.ID, "alert-no-baby-stations"))
            self.assertFalse(video_element.is_displayed())

            session_toggle.click()
            wait_for_element_to_be_displayed(driver_2, "video-parent-station")

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
            session_name = generate_random_string(10)
            session_name_input = driver_1_wait.until(lambda driver: driver.find_element(By.ID, "input-session-name"))
            session_name_input.clear()
            session_name_input.send_keys(session_name)
            select_video_device = driver_1_wait.until(lambda driver: Select(driver.find_element(By.ID, "select-video-device")))
            select_video_device.options[1].click()
            session_toggle = driver_1_wait.until(lambda driver: driver.find_element(By.ID, "session-toggle"))
            session_toggle.click()

            driver_2.get(f"{app_base_url}")
            login(driver_2, email, password)
            driver_2.find_element(By.ID, "nav-link-parent").click()

            driver_3.get(f"{app_base_url}")
            login(driver_3, email, password)
            driver_3.find_element(By.ID, "nav-link-parent").click()

            driver_2_wait = WebDriverWait(driver_2, 1)
            wait_for_element_to_be_displayed(driver_2, "video-parent-station")

            baby_station_dropdown_element = driver_2_wait.until(lambda driver: driver.find_element(By.ID, "baby-station-dropdown"))
            baby_station_dropdown = Select(baby_station_dropdown_element)
            self.assertEqual(len(baby_station_dropdown.options), 1)
            self.assertEqual(baby_station_dropdown.options[0].text, session_name)
            self.assertTrue(baby_station_dropdown.options[0].is_selected())

            driver_3_wait = WebDriverWait(driver_3, 1)
            wait_for_element_to_be_displayed(driver_3, "video-parent-station")

            baby_station_dropdown_element = driver_3_wait.until(lambda driver: driver.find_element(By.ID, "baby-station-dropdown"))
            baby_station_dropdown = Select(baby_station_dropdown_element)
            self.assertEqual(len(baby_station_dropdown.options), 1)
            self.assertEqual(baby_station_dropdown.options[0].text, session_name)
            self.assertTrue(baby_station_dropdown.options[0].is_selected())

            session_toggle.click()
            wait_for_element_to_not_be_displayed(driver_2, "video-parent-station")
            wait_for_element_to_not_be_displayed(driver_3, "video-parent-station")

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

            wait_for_element_to_be_displayed(driver_2, "video-parent-station")

            stop_backend_container()
            for _ in range(5):
                time.sleep(1)
                self.assertTrue(video_element.is_displayed())
            start_backend_container()
            for _ in range(10):
                time.sleep(1)
                self.assertTrue(video_element.is_displayed())

            session_toggle.click()
            wait_for_element_to_not_be_displayed(driver_2, "video-parent-station")