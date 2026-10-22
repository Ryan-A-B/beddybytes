import pytest
from selenium import webdriver

from protocol_drivers.Selenium import (
    SeleniumWebApp,
    app_base_url,
    chrome_options,
    hub_url,
)


@pytest.fixture
def webapp():
    with webdriver.Remote(
        command_executor=hub_url,
        options=chrome_options,
    ) as driver:
        driver.get(app_base_url)
        yield SeleniumWebApp(driver)
