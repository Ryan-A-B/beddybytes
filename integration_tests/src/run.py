import requests
import time
import unittest

from create_account_test import CreateAccountTest
from session_test import SessionTest

hub_url = 'http://selenium_hub:4444'
app_base_url = 'https://app.beddybytes.local'

def wait_for_selenium_hub():
    try:
        response = requests.get(hub_url)
        if response.status_code != 200:
            print('Selenium Hub is not ready')
            time.sleep(1)
            return wait_for_selenium_hub()
        print('Selenium Hub is ready')
    except:
        print('Selenium Hub is not ready')
        time.sleep(1)
        return wait_for_selenium_hub()

wait_for_selenium_hub()
unittest.main(verbosity=2)