import string
import secrets

from selenium.webdriver.common.by import By
from selenium.webdriver.support.wait import WebDriverWait

def create_account(driver, email, password):
    wait = WebDriverWait(driver, timeout=1)

    form_element = wait.until(lambda driver: driver.find_element(By.ID, "form-create-account"))

    email_input_element = form_element.find_element(By.ID, "input-create-account-email")
    email_input_element.send_keys(email)

    password_input_element = form_element.find_element(By.ID, "input-create-account-password")
    password_input_element.send_keys(password)

    submit_button_element = form_element.find_element(By.ID, "submit-button-create-account")
    submit_button_element.click()

    wait.until(lambda driver: driver.find_element(By.ID, "page-index"))

def login(driver, email, password):
    wait = WebDriverWait(driver, timeout=1)

    nav_button_login = wait.until(lambda driver: driver.find_element(By.ID, "nav-button-login"))
    nav_button_login.click()

    form_element = wait.until(lambda driver: driver.find_element(By.ID, "form-login"))
    
    email_input_element = form_element.find_element(By.ID, "input-login-email")
    email_input_element.send_keys(email)

    password_input_element = form_element.find_element(By.ID, "input-login-password")
    password_input_element.send_keys(password)

    submit_button_element = form_element.find_element(By.ID, "submit-button-login")
    submit_button_element.click()

    wait.until(lambda driver: driver.find_element(By.ID, "page-index"))

def get_browser_logs(driver):
    logs = []
    for log in driver.get_log('browser'):
        logs.append(log)
    return logs

def print_browser_logs(driver):
    for log in driver.get_log('browser'):
        print(log)

def generate_random_string(length):
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))