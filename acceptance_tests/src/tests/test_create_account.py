import time

from protocol.web_app import WebApp
from conftest import TestInput
from utils import generate_random_string

def test_license_is_trial_for_new_account(input: TestInput):
    with input.web_app_factory.create() as webapp:
        email = f'{generate_random_string(10)}@integrationtests.com'
        password = generate_random_string(20)
        webapp.create_account(email, password)
        webapp.open_account_screen()
        license_info = webapp.get_license_info()
        assert license_info.license_type == "trial"
        assert license_info.start_unix_timestamp is not None
        assert license_info.trial_detail is not None
        assert license_info.trial_detail.end_unix_timestamp is not None

def test_banner_is_displayed_for_expired_trial(input: TestInput):
    with input.web_app_factory.create() as webapp:
        email = f'{generate_random_string(10)}@integrationtests.com'
        password = generate_random_string(20)
        webapp.create_account(email, password)
        webapp.open_account_screen()
        license_info = webapp.get_license_info()
        sleep_duration = license_info.trial_detail.end_unix_timestamp - time.time()

    if sleep_duration > 0:
        time.sleep(sleep_duration)
        
    with input.web_app_factory.create() as webapp:
        webapp.login(email, password)
        assert webapp.trial_expired_banner_is_displayed()

def test_parent_station_stays_connected_when_trial_expires(input: TestInput):
    with input.web_app_factory.create() as web_app_1, input.web_app_factory.create() as web_app_2:
        email = f'{generate_random_string(10)}@integrationtests.com'
        password = generate_random_string(20)
        web_app_1.create_account(email, password)
        web_app_1.open_baby_station()
        web_app_1.approve_baby_station_media_access()
        camera_list = web_app_1.get_baby_station_camera_list()
        web_app_1.pick_baby_station_camera(camera_list[0])
        web_app_1.start_baby_station()

        web_app_2.login(email, password)
        web_app_2.open_account_screen()
        license_info = web_app_2.get_license_info()
        web_app_2.start_parent_station()
        web_app_2.wait_for_parent_station_to_connect()

        sleep_duration = license_info.trial_detail.end_unix_timestamp - time.time()
        while sleep_duration > 0:
            assert web_app_1.baby_station_active()
            assert web_app_2.session_active_in_parent_station()
            time.sleep(30)
            sleep_duration = license_info.trial_detail.end_unix_timestamp - time.time()

        assert web_app_1.trial_expired_banner_is_displayed()
        assert web_app_2.trial_expired_banner_is_displayed()
