import time
import logging
from typing import List, Callable, TypedDict

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.wait import WebDriverWait
from selenium.webdriver.support.ui import Select
from selenium.common.exceptions import NoSuchElementException

from settings import hub_url, app_base_url, chrome_options
from utils import create_account, login, stop_backend_container, start_backend_container, generate_random_string, get_random_bool, print_browser_logs

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def allow_time_for_video_to_display():
    time.sleep(0.1)

email = f'{generate_random_string(10)}@integrationtests.com'
password = generate_random_string(20)

with webdriver.Remote(command_executor=hub_url, options=chrome_options) as baby_station_driver, webdriver.Remote(command_executor=hub_url, options=chrome_options) as parent_station_driver:
    # Baby Station
    baby_station_driver.get(app_base_url)
    create_account(baby_station_driver, email, password)
    baby_station_driver.find_element(By.ID, "nav-link-baby").click()
    baby_station_driver_wait = WebDriverWait(baby_station_driver, 1)
    continue_button = baby_station_driver_wait.until(lambda driver: driver.find_element(By.ID, "button-continue-media-stream-permission-check"))
    continue_button.click()
    select_video_device = baby_station_driver_wait.until(lambda driver: Select(driver.find_element(By.ID, "select-video-device")))
    select_video_device.options[1].click()
    session_toggle = baby_station_driver_wait.until(lambda driver: driver.find_element(By.ID, "session-toggle"))
    session_toggle.click()
    while session_toggle.text != "Stop":
        time.sleep(1)

    # Parent Station
    parent_station_driver.get(app_base_url)
    login(parent_station_driver, email, password)
    parent_station_driver.find_element(By.ID, "nav-link-parent").click()
    parent_station_driver_wait = WebDriverWait(parent_station_driver, 1)
    session_dropdown = parent_station_driver_wait.until(lambda driver: Select(driver.find_element(By.ID, "session-dropdown")))
    first_session_option = session_dropdown.options[1]
    first_session_option.click()

    video_element = parent_station_driver_wait.until(lambda driver: driver.find_element(By.ID, "video-parent-station"))
    allow_time_for_video_to_display()
    if not video_element.is_displayed():
        raise Exception("Video element is not displayed")
    parent_station_driver.save_screenshot("screenshots/backend_outage_test/parent_station/1.png")
    
    stop_backend_container()
    for i in range(30 * 60):
        if i % 60 == 0:
            print(f'First loop {i}')
        time.sleep(1)
        if not video_element.is_displayed():
            parent_station_driver.save_screenshot("screenshots/backend_outage_test/parent_station/failure_1.png")
            raise Exception("Video element is not displayed")
        if session_toggle.text != "Stop":
            raise Exception("Session toggle is not Stop")
    parent_station_driver.save_screenshot("screenshots/backend_outage_test/parent_station/2.png")
    start_backend_container()
    for i in range(5*60):
        if i % 60 == 0:
            print(f'Second loop {i}')
        time.sleep(1)
        if not video_element.is_displayed():
            parent_station_driver.save_screenshot("screenshots/backend_outage_test/parent_station/failure_2.png")
            raise Exception("Video element is not displayed")
        if session_toggle.text != "Stop":
            raise Exception("Session toggle is not Stop")
    parent_station_driver.save_screenshot("screenshots/backend_outage_test/parent_station/3.png")