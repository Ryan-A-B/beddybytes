import time

from conftest import TestInput
from utils import generate_random_string

def test_purchase_lifetime(input: TestInput):
    with input.web_app_factory.create() as webapp:
        email = f'{generate_random_string(10)}@integrationtests.com'
        password = generate_random_string(20)
        webapp.create_account(email, password)
        webapp.open_account_screen()
        webapp.open_checkout()
        webapp.pay()
        assert webapp.get_current_screen() == "payment_success"
        webapp.open_account_screen()
        license_info = webapp.get_license_info()
        assert license_info.license_type == "perpetual"
