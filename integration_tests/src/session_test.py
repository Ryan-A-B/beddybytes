import unittest
import time

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.wait import WebDriverWait
from selenium.webdriver.support.ui import Select
from selenium.common.exceptions import NoSuchElementException

from settings import hub_url, app_base_url, chrome_options
from utils import create_account, login, get_browser_logs, generate_random_string

class SessionTest(unittest.TestCase):
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
            audio_element = driver_2_wait.until(lambda driver: driver.find_element(By.ID, "audio-parent"))

            session_toggle.click()
            alert_session_ended = driver_2_wait.until(lambda driver: driver.find_element(By.ID, "alert-session-ended"))
            self.assertTrue(alert_session_ended.is_displayed())
            self.assertRaises(NoSuchElementException, driver_2.find_element, By.ID, "audio-parent")

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
            session_dropdown_element = driver_2_wait.until(lambda driver: driver.find_element(By.ID, "session-dropdown"))
            session_dropdown = Select(session_dropdown_element)
            self.assertEqual(len(session_dropdown.options), 2)
            self.assertEqual(session_dropdown.options[0].get_attribute("value"), "")
            self.assertNotEqual(session_dropdown.options[1].get_attribute("value"), "")

            session_dropdown.options[1].click()

            driver_2_wait = WebDriverWait(driver_2, 1)
            video_element = driver_2_wait.until(lambda driver: driver.find_element(By.ID, "video-parent"))
            self.assertTrue(video_element.is_displayed())

            session_toggle.click()
            alert_session_ended = driver_2_wait.until(lambda driver: driver.find_element(By.ID, "alert-session-ended"))
            self.assertTrue(alert_session_ended.is_displayed())
            self.assertRaises(NoSuchElementException, driver_2.find_element, By.ID, "video-parent")

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

            driver_2_wait = WebDriverWait(driver_2, 2)
            session_dropdown_element = driver_2_wait.until(lambda driver: driver.find_element(By.ID, "session-dropdown"))
            session_dropdown = Select(session_dropdown_element)
            session_dropdown.options[1].click()

            video_element = driver_2_wait.until(lambda driver: driver.find_element(By.ID, "video-parent"))
            self.assertTrue(video_element.is_displayed())

            session_toggle.click()
            alert_session_ended = driver_2_wait.until(lambda driver: driver.find_element(By.ID, "alert-session-ended"))
            self.assertTrue(alert_session_ended.is_displayed())
            self.assertRaises(NoSuchElementException, driver_2.find_element, By.ID, "video-parent")

            session_toggle.click()
            session_dropdown_element = driver_2_wait.until(lambda driver: driver.find_element(By.ID, "session-dropdown"))
            session_dropdown = Select(session_dropdown_element)
            self.assertEqual(len(session_dropdown.options), 2)
            self.assertEqual(session_dropdown.options[0].get_attribute("value"), "")
            self.assertNotEqual(session_dropdown.options[1].get_attribute("value"), "")
            session_dropdown.options[1].click()
            video_element = driver_2_wait.until(lambda driver: driver.find_element(By.ID, "video-parent"))
            self.assertTrue(video_element.is_displayed())

            driver_1_logs = get_browser_logs(driver_1)
            driver_2_logs = get_browser_logs(driver_2)

            self.assertEqual(len(driver_1_logs), 0)
            self.assertEqual(len(driver_2_logs), 0)
