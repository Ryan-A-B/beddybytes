import os
import requests
import time
from selenium import webdriver
from selenium.webdriver.common.by import By

email = os.environ.get('EMAIL')
password = os.environ.get('PASSWORD')

def wait_for_selenium_hub():
    try:
        response = requests.get('http://hub:4444')
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

options = webdriver.FirefoxOptions()

driver = webdriver.Remote(
    command_executor='http://hub:4444',
    options=options,
)

try:
    driver.get("https://app.babymonitor.creativeilk.com")
    driver.implicitly_wait(2)

    body = driver.find_element(By.CSS_SELECTOR, "body")
    input_email = body.find_element(By.CSS_SELECTOR, "input[name='email']")
    input_email.send_keys(email)
    input_password = body.find_element(By.CSS_SELECTOR, "input[name='password']")
    input_password.send_keys(password)
    # button_submit = body.find_element(By.CSS_SELECTOR, "button[type='submit']")
    # button_submit.click()

    body.screenshot('screenshot.png')
except Exception as e:
    print(e)
finally:
    driver.quit()
