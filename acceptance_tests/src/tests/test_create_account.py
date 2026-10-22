from dsl.WebApp import WebApp
from utils import generate_random_string


class TestCreateAccount:
    def test_one(self, webapp: WebApp):
        email = f'{generate_random_string(10)}@integrationtests.com'
        password = generate_random_string(20)
        webapp.create_account(email, password)
        license_info = webapp.get_license_info()
        assert license_info.license_type == "trial"
        assert license_info.start_unix_timestamp is not None
        assert license_info.end_unix_timestamp is not None
