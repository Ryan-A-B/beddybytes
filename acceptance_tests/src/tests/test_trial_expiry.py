import time

from conftest import TestInput
from utils import generate_random_string

def test_baby_station_start_disabled_when_trial_expires_before_session(input: TestInput):
    with input.web_app_factory.create() as webapp:
        email = f'{generate_random_string(10)}@integrationtests.com'
        password = generate_random_string(20)
        webapp.create_account(email, password)
        webapp.open_account_screen()
        license_info = webapp.get_license_info()

        webapp.open_baby_station()
        webapp.approve_baby_station_media_access()
        camera_list = webapp.get_baby_station_camera_list()
        webapp.pick_baby_station_camera(camera_list[0])

        sleep_duration = license_info.trial_detail.end_unix_timestamp - time.time()
        while sleep_duration > 0:
            assert not webapp.baby_station_start_disabled()
            time.sleep(30)
            sleep_duration = license_info.trial_detail.end_unix_timestamp - time.time()
        assert webapp.baby_station_start_disabled()

def test_baby_station_start_disabled_when_trial_expires_during_session(input: TestInput):
    with input.web_app_factory.create() as webapp:
        email = f'{generate_random_string(10)}@integrationtests.com'
        password = generate_random_string(20)
        webapp.create_account(email, password)
        webapp.open_account_screen()
        license_info = webapp.get_license_info()

        webapp.open_baby_station()
        webapp.approve_baby_station_media_access()
        camera_list = webapp.get_baby_station_camera_list()
        webapp.pick_baby_station_camera(camera_list[0])
        webapp.start_baby_station()

        sleep_duration = license_info.trial_detail.end_unix_timestamp - time.time()
        while sleep_duration > 0:
            assert webapp.baby_station_active()
            time.sleep(30)
            sleep_duration = license_info.trial_detail.end_unix_timestamp - time.time()
        webapp.stop_baby_station_session()
        assert not webapp.baby_station_active()
        assert webapp.baby_station_start_disabled()

