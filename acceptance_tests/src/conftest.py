import pytest
from selenium import webdriver
from dataclasses import dataclass
import protocol.web_app
import protocol.api_client
from protocol_drivers.api_client_http_driver import APIClientHTTPDriverFactory
from protocol_drivers.web_app_selenium_driver import WebAppSeleniumDriverFactory

@dataclass
class TestInput:
    __test__ = False
    web_app_factory: protocol.web_app.WebAppFactory
    api_client_factory: protocol.api_client.APIClientFactory

@pytest.fixture
def input():
    return TestInput(
        web_app_factory=WebAppSeleniumDriverFactory(),
        api_client_factory=APIClientHTTPDriverFactory(),
    )
