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

# When either baby station or parent station is not connected to the backend attempts to connect the parent station to the baby station will fail
# When backend disconnects for a while, baby station attempts to reconnect with an exponential backoff. If a parent station attempts to connect before the baby station has reconnected it will fail

Command = Callable[[], List['Command']]
CommandList = List[Command]

class Ticker:
    def __init__(self) -> None:
        self.ticks = 0

    def __call__(self) -> CommandList:
        time.sleep(1)
        self.ticks += 1
        return [self]
    
    def __del__(self) -> None:
        logging.info(f"Test ran for {self.ticks} ticks")

class BackendDisruptor:
    def __init__(self):
        self.status = "running"

    def __call__(self):
        if self.status == "running":
            self.handle_running()
        elif self.status == "stopped":
            self.handle_stopped()
        return [self]
    
    def handle_running(self):
        # On average, stop the backend container once every two hours
        if get_random_bool(1 / (2 * 60 * 60)):
            logging.info("stopping backend container")
            stop_backend_container()
            self.status = "stopped"

    def handle_stopped(self):
        # On average, start the backend container once every ten minutes
        if get_random_bool(1 / (10 * 60)):
            logging.info("starting backend container")
            start_backend_container()
            self.status = "running"

class NewBabyStationInput(TypedDict):
    email: str
    password: str

class BabyStation:
    driver: webdriver.Remote
    email: str
    password: str

    def __init__(self, input: NewBabyStationInput):
        logging.info("baby station starting")
        self.email = input["email"]
        self.password = input["password"]
        self.driver = webdriver.Remote(command_executor=hub_url, options=chrome_options)
        self.driver.get(app_base_url)
        create_account(self.driver, email, password)
        self.driver.find_element(By.ID, "nav-link-baby").click()
        driver_wait = WebDriverWait(self.driver, 1)
        continue_button = driver_wait.until(lambda driver: driver.find_element(By.ID, "button-continue-media-stream-permission-check"))
        continue_button.click()
        select_video_device = driver_wait.until(lambda driver: Select(driver.find_element(By.ID, "select-video-device")))
        select_video_device.options[1].click()
        self.session_toggle = driver_wait.until(lambda driver: driver.find_element(By.ID, "session-toggle"))
        self.session_toggle.click()
        self.wait_until_session_toggle_says_stop()

    def __del__(self):
        logging.info("baby station quitting")
        self.driver.quit()

    def __call__(self):
        session_toggle_text = self.session_toggle.text
        if session_toggle_text != "Stop":
            raise Exception(f"session_toggle_text is {session_toggle_text}, expected 'Stop'")
        return [self]
        
    def wait_until_session_toggle_says_stop(self):
        while self.session_toggle.text != "Stop":
            time.sleep(1)

class NewParentInput(TypedDict):
    backend_disruptor: BackendDisruptor
    name: str
    email: str
    password: str
    probability_of_connecting: float
    probability_of_disconnecting: float

class ParentStation:
    def __init__(self, input: NewParentInput):
        self.status = "disconnected"
        self.backend_disruptor = input["backend_disruptor"]
        self.name = input["name"]
        self.email = input["email"]
        self.password = input["password"]
        self.probability_of_connecting = input["probability_of_connecting"]
        self.probability_of_disconnecting = input["probability_of_disconnecting"]
        self.driver = None

    def __call__(self):
        if self.status == "disconnected":
            self.handle_disconnected()
        elif self.status == "connected":
            self.handle_connected()
        return [self]
    
    def __del__(self):
        if self.driver:
            logging.info(f"{self.name} quitting")
            self.driver.quit()

    def allow_time_for_video_to_display(self):
        time.sleep(0.5)

    def handle_disconnected(self):
        if self.backend_disruptor.status == "stopped":
            return
        if get_random_bool(self.probability_of_connecting):
            self.connect()

    def connect(self):
        logging.info(f"{self.name} connecting")
        self.driver = webdriver.Remote(command_executor=hub_url, options=chrome_options)
        self.driver.get(app_base_url)
        login(self.driver, self.email, self.password)
        self.driver.find_element(By.ID, "nav-link-parent").click()
        driver_wait = WebDriverWait(self.driver, 1)
        session_dropdown = driver_wait.until(lambda driver: Select(driver.find_element(By.ID, "session-dropdown")))
        first_session_option = session_dropdown.options[1]
        if first_session_option.text.endswith(" 🔴"):
            print(f"{self.name} could not connect because the baby station is unavailable")
            return
        first_session_option.click()
        video_element = driver_wait.until(lambda driver: driver.find_element(By.ID, "video-parent-station"))
        self.allow_time_for_video_to_display()
        if not video_element.is_displayed():
            raise Exception(f"{self.name} video element is not displayed")
        self.status = "connected"

    def handle_connected(self):
        driver_wait = WebDriverWait(self.driver, 1)
        video_element = driver_wait.until(lambda driver: driver.find_element(By.ID, "video-parent-station"))
        if not video_element.is_displayed():
            raise Exception(f"{self.name} video element is not displayed")

        if get_random_bool(self.probability_of_disconnecting):
            self.disconnect()

    def disconnect(self):
        logging.info(f"{self.name} disconnecting")
        print_browser_logs(self.driver)
        self.driver.quit()
        self.driver = None
        self.status = "disconnected"

email = f'{generate_random_string(10)}@integrationtests.com'
password = generate_random_string(20)

backend_disruptor = BackendDisruptor()
baby_station = BabyStation({
    "email": email,
    "password": password,
})
parent_station_1 = ParentStation({
    "backend_disruptor": backend_disruptor,
    "name": "parent_station_1",
    "email": email,
    "password": password,
    "probability_of_connecting": 1 / 20, # On average, connect once every twenty seconds
    "probability_of_disconnecting": 1 / (2 * 60 * 60), # On average, disconnect once every 2 hours
})
parent_station_2 = ParentStation({
    "backend_disruptor": backend_disruptor,
    "name": "parent_station_2",
    "email": email,
    "password": password,
    "probability_of_connecting": 1 / (10 * 60), # On average, connect once every ten minutes
    "probability_of_disconnecting": 1 / (20), # On average, disconnect once every twenty seconds
})
parent_station_3 = ParentStation({
    "backend_disruptor": backend_disruptor,
    "name": "parent_station_3",
    "email": email,
    "password": password,
    "probability_of_connecting": 1 / (60 * 60), # On average, connect once every hour
    "probability_of_disconnecting": 1 / (10 * 60), # On average, disconnect once every ten minutes
})
ticker = Ticker()

commands: CommandList = [baby_station, parent_station_1, parent_station_2, parent_station_3, backend_disruptor, ticker]
while len(commands) > 0:
    command = commands.pop(0)
    new_commands = command()
    commands.extend(new_commands)
