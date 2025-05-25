import unittest
import time

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.wait import WebDriverWait
from selenium.webdriver.support.ui import Select
from selenium.common.exceptions import NoSuchElementException

from settings import hub_url, app_base_url, chrome_options
from utils import create_account, login, get_browser_logs, generate_random_string, wait_for_element_to_be_displayed, wait_for_element_to_be_removed

class TestTwoBabyStations(unittest.TestCase):
    def test_parent_station_first(self):
        email = f'{generate_random_string(10)}@integrationtests.com'
        password = generate_random_string(20)
        sessions = [
            {
                "name": generate_random_string(10),
            },
            {
                "name": generate_random_string(10),
            },
        ]

        with webdriver.Remote(command_executor=hub_url, options=chrome_options) as driver_1, webdriver.Remote(command_executor=hub_url, options=chrome_options) as driver_2, webdriver.Remote(command_executor=hub_url, options=chrome_options) as driver_3:
            driver_1.get(f"{app_base_url}")
            create_account(driver_1, email, password)
            driver_1.find_element(By.ID, "nav-link-parent").click()
            driver_1_wait = WebDriverWait(driver_1, 1)

            driver_1_wait.until(lambda driver: driver.find_element(By.ID, "alert-no-baby-stations"))
            video_element = driver_1_wait.until(lambda driver: driver.find_element(By.ID, "video-parent-station"))
            self.assertFalse(video_element.is_displayed())

            driver_2.get(f"{app_base_url}")
            login(driver_2, email, password)
            driver_2.find_element(By.ID, "nav-link-baby").click()
            driver_2_wait = WebDriverWait(driver_2, 1)

            continue_button = driver_2_wait.until(lambda driver: driver.find_element(By.ID, "button-continue-media-stream-permission-check"))
            continue_button.click()

            session_name_input = driver_2_wait.until(lambda driver: driver.find_element(By.ID, "input-session-name"))
            session_name_input.clear()
            session_name_input.send_keys(sessions[0]["name"])

            select_video_device = driver_2_wait.until(lambda driver: Select(driver.find_element(By.ID, "select-video-device")))
            select_video_device.options[1].click()

            session_toggle_2 = driver_2_wait.until(lambda driver: driver.find_element(By.ID, "session-toggle"))
            session_toggle_2.click()

            wait_for_element_to_be_displayed(driver_1, "video-parent-station")
            wait_for_element_to_be_removed(driver_1, "alert-no-baby-stations")
            baby_station_dropdown_element = driver_1_wait.until(lambda driver: driver.find_element(By.ID, "baby-station-dropdown"))
            baby_station_dropdown = Select(baby_station_dropdown_element)
            self.assertEqual(video_element.get_attribute("data-session-name"), sessions[0]["name"])
            self.assertEqual(len(baby_station_dropdown.options), 1)

            driver_3.get(f"{app_base_url}")
            login(driver_3, email, password)
            driver_3.find_element(By.ID, "nav-link-baby").click()
            driver_3_wait = WebDriverWait(driver_3, 1)

            continue_button = driver_3_wait.until(lambda driver: driver.find_element(By.ID, "button-continue-media-stream-permission-check"))
            continue_button.click()

            session_name_input = driver_3_wait.until(lambda driver: driver.find_element(By.ID, "input-session-name"))
            session_name_input.clear()
            session_name_input.send_keys(sessions[1]["name"])

            select_video_device = driver_3_wait.until(lambda driver: Select(driver.find_element(By.ID, "select-video-device")))
            select_video_device.options[1].click()

            session_toggle_3 = driver_3_wait.until(lambda driver: driver.find_element(By.ID, "session-toggle"))
            session_toggle_3.click()

            wait_for_element_to_be_displayed(driver_1, "video-parent-station")
            wait_for_element_to_be_removed(driver_1, "alert-no-baby-stations")
            self.assertEqual(video_element.get_attribute("data-session-name"), sessions[0]["name"])
            self.assertEqual(len(baby_station_dropdown.options), 2)

            with self.assertRaises(NoSuchElementException):
                driver_1.find_element(By.ID, "container-errors")

            driver_1_logs = get_browser_logs(driver_1)
            self.assertEqual(len(driver_1_logs), 0)
            driver_2_logs = get_browser_logs(driver_2)
            self.assertEqual(len(driver_2_logs), 0)
            driver_3_logs = get_browser_logs(driver_3)
            self.assertEqual(len(driver_3_logs), 0)

    def test_parent_station_second(self):
        email = f'{generate_random_string(10)}@integrationtests.com'
        password = generate_random_string(20)
        sessions = [
            {
                "name": generate_random_string(10),
            },
            {
                "name": generate_random_string(10),
            },
        ]

        with webdriver.Remote(command_executor=hub_url, options=chrome_options) as driver_1, webdriver.Remote(command_executor=hub_url, options=chrome_options) as driver_2, webdriver.Remote(command_executor=hub_url, options=chrome_options) as driver_3:
            driver_1.get(f"{app_base_url}")
            create_account(driver_1, email, password)
            driver_1.find_element(By.ID, "nav-link-baby").click()
            driver_1_wait = WebDriverWait(driver_1, 1)
            continue_button = driver_1_wait.until(lambda driver: driver.find_element(By.ID, "button-continue-media-stream-permission-check"))
            continue_button.click()
            session_name_input = driver_1_wait.until(lambda driver: driver.find_element(By.ID, "input-session-name"))
            session_name_input.clear()
            session_name_input.send_keys(sessions[0]["name"])
            select_video_device = driver_1_wait.until(lambda driver: Select(driver.find_element(By.ID, "select-video-device")))
            select_video_device.options[1].click()
            session_toggle_1 = driver_1_wait.until(lambda driver: driver.find_element(By.ID, "session-toggle"))
            session_toggle_1.click()

            driver_2.get(f"{app_base_url}")
            login(driver_2, email, password)
            driver_2.find_element(By.ID, "nav-link-parent").click()
            driver_2_wait = WebDriverWait(driver_2, 1)
            video_element = driver_2_wait.until(lambda driver: driver.find_element(By.ID, "video-parent-station"))

            wait_for_element_to_be_displayed(driver_2, "video-parent-station")
            self.assertEqual(video_element.get_attribute("data-session-name"), sessions[0]["name"])
            baby_station_dropdown_element = driver_2_wait.until(lambda driver: driver.find_element(By.ID, "baby-station-dropdown"))
            baby_station_dropdown = Select(baby_station_dropdown_element)
            self.assertEqual(len(baby_station_dropdown.options), 1)

            driver_3.get(f"{app_base_url}")
            login(driver_3, email, password)
            driver_3.find_element(By.ID, "nav-link-baby").click()
            driver_3_wait = WebDriverWait(driver_3, 1)
            continue_button = driver_3_wait.until(lambda driver: driver.find_element(By.ID, "button-continue-media-stream-permission-check"))
            continue_button.click()
            session_name_input = driver_3_wait.until(lambda driver: driver.find_element(By.ID, "input-session-name"))
            session_name_input.clear()
            session_name_input.send_keys(sessions[1]["name"])
            select_video_device = driver_3_wait.until(lambda driver: Select(driver.find_element(By.ID, "select-video-device")))
            select_video_device.options[1].click()
            session_toggle_3 = driver_3_wait.until(lambda driver: driver.find_element(By.ID, "session-toggle"))
            session_toggle_3.click()

            wait_for_element_to_be_displayed(driver_2, "video-parent-station")
            wait_for_element_to_be_removed(driver_2, "alert-no-baby-stations")
            self.assertEqual(video_element.get_attribute("data-session-name"), sessions[0]["name"])
            self.assertEqual(len(baby_station_dropdown.options), 2)

            with self.assertRaises(NoSuchElementException):
                driver_2.find_element(By.ID, "container-errors")

            driver_1_logs = get_browser_logs(driver_1)
            self.assertEqual(len(driver_1_logs), 0)
            driver_2_logs = get_browser_logs(driver_2)
            self.assertEqual(len(driver_2_logs), 0)
            driver_3_logs = get_browser_logs(driver_3)
            self.assertEqual(len(driver_3_logs), 0)

    def test_switching_between_baby_stations(self):
        email = f'{generate_random_string(10)}@integrationtests.com'
        password = generate_random_string(20)
        sessions = [
            {
                "name": generate_random_string(10),
                "option": None,
            },
            {
                "name": generate_random_string(10),
                "option": None,
            },
        ]

        with webdriver.Remote(command_executor=hub_url, options=chrome_options) as driver_1, webdriver.Remote(command_executor=hub_url, options=chrome_options) as driver_2, webdriver.Remote(command_executor=hub_url, options=chrome_options) as driver_3:
            driver_1.get(f"{app_base_url}")
            create_account(driver_1, email, password)
            driver_1.find_element(By.ID, "nav-link-baby").click()
            driver_1_wait = WebDriverWait(driver_1, 1)

            continue_button = driver_1_wait.until(lambda driver: driver.find_element(By.ID, "button-continue-media-stream-permission-check"))
            continue_button.click()

            session_name_input = driver_1_wait.until(lambda driver: driver.find_element(By.ID, "input-session-name"))
            session_name_input.clear()
            session_name_input.send_keys(sessions[0]["name"])

            select_video_device = driver_1_wait.until(lambda driver: Select(driver.find_element(By.ID, "select-video-device")))
            select_video_device.options[1].click()

            session_toggle_1 = driver_1_wait.until(lambda driver: driver.find_element(By.ID, "session-toggle"))
            session_toggle_1.click()

            driver_2.get(f"{app_base_url}")
            login(driver_2, email, password)
            driver_2.find_element(By.ID, "nav-link-baby").click()
            driver_2_wait = WebDriverWait(driver_2, 1)

            continue_button = driver_2_wait.until(lambda driver: driver.find_element(By.ID, "button-continue-media-stream-permission-check"))
            continue_button.click()

            session_name_input = driver_2_wait.until(lambda driver: driver.find_element(By.ID, "input-session-name"))
            session_name_input.clear()
            session_name_input.send_keys(sessions[1]["name"])

            select_video_device = driver_2_wait.until(lambda driver: Select(driver.find_element(By.ID, "select-video-device")))
            select_video_device.options[1].click()

            session_toggle_2 = driver_2_wait.until(lambda driver: driver.find_element(By.ID, "session-toggle"))
            session_toggle_2.click()

            driver_3.get(f"{app_base_url}")
            login(driver_3, email, password)
            driver_3.find_element(By.ID, "nav-link-parent").click()

            driver_3_wait = WebDriverWait(driver_3, 1)
            baby_station_dropdown_element = driver_3_wait.until(lambda driver: driver.find_element(By.ID, "baby-station-dropdown"))
            baby_station_dropdown = Select(baby_station_dropdown_element)
            self.assertEqual(len(baby_station_dropdown.options), 2)

            for session in sessions:
                for option in baby_station_dropdown.options:
                    if option.text == session["name"]:
                        self.assertIsNone(session["option"])
                        session["option"] = option
                        break
                self.assertIsNotNone(session["option"])

            video_element = driver_3_wait.until(lambda driver: driver.find_element(By.ID, "video-parent-station"))
            sessions[0]["option"].click()
            wait_for_element_to_be_displayed(driver_3, "video-parent-station")
            self.assertTrue(sessions[0]["option"].is_selected())
            self.assertEqual(video_element.get_attribute("data-session-name"), sessions[0]["name"])

            sessions[1]["option"].click()
            wait_for_element_to_be_displayed(driver_3, "video-parent-station")
            self.assertTrue(sessions[1]["option"].is_selected())
            self.assertEqual(video_element.get_attribute("data-session-name"), sessions[1]["name"])

            sessions[0]["option"].click()
            wait_for_element_to_be_displayed(driver_3, "video-parent-station")
            self.assertTrue(sessions[0]["option"].is_selected())
            self.assertEqual(video_element.get_attribute("data-session-name"), sessions[0]["name"])

            with self.assertRaises(NoSuchElementException):
                driver_3.find_element(By.ID, "container-errors")

            driver_1_logs = get_browser_logs(driver_1)
            self.assertEqual(len(driver_1_logs), 0)
            driver_2_logs = get_browser_logs(driver_2)
            self.assertEqual(len(driver_2_logs), 0)
            driver_3_logs = get_browser_logs(driver_3)
            self.assertEqual(len(driver_3_logs), 0)

    def test_end_session_for_baby_station_that_is_currently_shown(self):
        email = f'{generate_random_string(10)}@integrationtests.com'
        password = generate_random_string(20)
        sessions = [
            {
                "name": generate_random_string(10),
                "toggle": None,
            },
            {
                "name": generate_random_string(10),
                "toggle": None,
            }
        ]

        with webdriver.Remote(command_executor=hub_url, options=chrome_options) as driver_1, webdriver.Remote(command_executor=hub_url, options=chrome_options) as driver_2, webdriver.Remote(command_executor=hub_url, options=chrome_options) as driver_3:
            driver_1.get(f"{app_base_url}")
            create_account(driver_1, email, password)
            driver_1.find_element(By.ID, "nav-link-baby").click()
            driver_1_wait = WebDriverWait(driver_1, 1)

            continue_button = driver_1_wait.until(lambda driver: driver.find_element(By.ID, "button-continue-media-stream-permission-check"))
            continue_button.click()

            session_name_input = driver_1_wait.until(lambda driver: driver.find_element(By.ID, "input-session-name"))
            session_name_input.clear()
            session_name_input.send_keys(sessions[0]["name"])

            select_video_device = driver_1_wait.until(lambda driver: Select(driver.find_element(By.ID, "select-video-device")))
            select_video_device.options[1].click()

            sessions[0]["toggle"] = driver_1_wait.until(lambda driver: driver.find_element(By.ID, "session-toggle"))
            sessions[0]["toggle"].click()

            driver_2.get(f"{app_base_url}")
            login(driver_2, email, password)
            driver_2.find_element(By.ID, "nav-link-baby").click()
            driver_2_wait = WebDriverWait(driver_2, 1)

            continue_button = driver_2_wait.until(lambda driver: driver.find_element(By.ID, "button-continue-media-stream-permission-check"))
            continue_button.click()

            session_name_input = driver_2_wait.until(lambda driver: driver.find_element(By.ID, "input-session-name"))
            session_name_input.clear()
            session_name_input.send_keys(sessions[1]["name"])

            select_video_device = driver_2_wait.until(lambda driver: Select(driver.find_element(By.ID, "select-video-device")))
            select_video_device.options[1].click()

            sessions[1]["toggle"] = driver_2_wait.until(lambda driver: driver.find_element(By.ID, "session-toggle"))
            sessions[1]["toggle"].click()

            driver_3.get(f"{app_base_url}")
            login(driver_3, email, password)
            driver_3.find_element(By.ID, "nav-link-parent").click()

            driver_3_wait = WebDriverWait(driver_3, 1)
            baby_station_dropdown_element = driver_3_wait.until(lambda driver: driver.find_element(By.ID, "baby-station-dropdown"))
            baby_station_dropdown = Select(baby_station_dropdown_element)
            self.assertEqual(len(baby_station_dropdown.options), 2)
            
            video_element = driver_3_wait.until(lambda driver: driver.find_element(By.ID, "video-parent-station"))
            wait_for_element_to_be_displayed(driver_3, "video-parent-station")

            selected_option_text = baby_station_dropdown.first_selected_option.text
            [active_session, inactive_session] = sessions if selected_option_text == sessions[0]["name"] else sessions[::-1]
            active_session["toggle"].click()
            wait_for_element_to_be_displayed(driver_3, "video-parent-station")
            self.assertEqual(len(baby_station_dropdown.options), 1)
            self.assertEqual(baby_station_dropdown.options[0].text, inactive_session["name"])

            with self.assertRaises(NoSuchElementException):
                driver_3.find_element(By.ID, "container-errors")

            driver_1_logs = get_browser_logs(driver_1)
            self.assertEqual(len(driver_1_logs), 0)
            driver_2_logs = get_browser_logs(driver_2)
            self.assertEqual(len(driver_2_logs), 0)
            driver_3_logs = get_browser_logs(driver_3)
            self.assertEqual(len(driver_3_logs), 0)

    def test_end_session_for_baby_station_that_is_not_currently_shown(self):
        email = f'{generate_random_string(10)}@integrationtests.com'
        password = generate_random_string(20)
        sessions = [
            {
                "name": generate_random_string(10),
                "toggle": None,
            },
            {
                "name": generate_random_string(10),
                "toggle": None,
            }
        ]

        with webdriver.Remote(command_executor=hub_url, options=chrome_options) as driver_1, webdriver.Remote(command_executor=hub_url, options=chrome_options) as driver_2, webdriver.Remote(command_executor=hub_url, options=chrome_options) as driver_3:
            driver_1.get(f"{app_base_url}")
            create_account(driver_1, email, password)
            driver_1.find_element(By.ID, "nav-link-baby").click()
            driver_1_wait = WebDriverWait(driver_1, 1)

            continue_button = driver_1_wait.until(lambda driver: driver.find_element(By.ID, "button-continue-media-stream-permission-check"))
            continue_button.click()

            session_name_input = driver_1_wait.until(lambda driver: driver.find_element(By.ID, "input-session-name"))
            session_name_input.clear()
            session_name_input.send_keys(sessions[0]["name"])

            select_video_device = driver_1_wait.until(lambda driver: Select(driver.find_element(By.ID, "select-video-device")))
            select_video_device.options[1].click()

            sessions[0]["toggle"] = driver_1_wait.until(lambda driver: driver.find_element(By.ID, "session-toggle"))
            sessions[0]["toggle"].click()

            driver_2.get(f"{app_base_url}")
            login(driver_2, email, password)
            driver_2.find_element(By.ID, "nav-link-baby").click()
            driver_2_wait = WebDriverWait(driver_2, 1)

            continue_button = driver_2_wait.until(lambda driver: driver.find_element(By.ID, "button-continue-media-stream-permission-check"))
            continue_button.click()

            session_name_input = driver_2_wait.until(lambda driver: driver.find_element(By.ID, "input-session-name"))
            session_name_input.clear()
            session_name_input.send_keys(sessions[1]["name"])

            select_video_device = driver_2_wait.until(lambda driver: Select(driver.find_element(By.ID, "select-video-device")))
            select_video_device.options[1].click()

            sessions[1]["toggle"] = driver_2_wait.until(lambda driver: driver.find_element(By.ID, "session-toggle"))
            sessions[1]["toggle"].click()

            driver_3.get(f"{app_base_url}")
            login(driver_3, email, password)
            driver_3.find_element(By.ID, "nav-link-parent").click()

            driver_3_wait = WebDriverWait(driver_3, 1)
            baby_station_dropdown_element = driver_3_wait.until(lambda driver: driver.find_element(By.ID, "baby-station-dropdown"))
            baby_station_dropdown = Select(baby_station_dropdown_element)
            self.assertEqual(len(baby_station_dropdown.options), 2)
            
            wait_for_element_to_be_displayed(driver_3, "video-parent-station")

            selected_option_text = baby_station_dropdown.first_selected_option.text
            [active_session, inactive_session] = sessions if selected_option_text == sessions[0]["name"] else sessions[::-1]
            inactive_session["toggle"].click()
            wait_for_element_to_be_displayed(driver_3, "video-parent-station")
            self.assertEqual(len(baby_station_dropdown.options), 1)
            self.assertEqual(baby_station_dropdown.options[0].text, active_session["name"])

            with self.assertRaises(NoSuchElementException):
                driver_3.find_element(By.ID, "container-errors")

            driver_1_logs = get_browser_logs(driver_1)
            self.assertEqual(len(driver_1_logs), 0)
            driver_2_logs = get_browser_logs(driver_2)
            self.assertEqual(len(driver_2_logs), 0)
            driver_3_logs = get_browser_logs(driver_3)
            self.assertEqual(len(driver_3_logs), 0)