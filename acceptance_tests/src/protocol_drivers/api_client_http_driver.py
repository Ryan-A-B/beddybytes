import json
import os
import ssl
from contextlib import contextmanager
from typing import Iterator
from urllib.parse import urlencode
from urllib.request import HTTPSHandler, Request, build_opener

from protocol.api_client import TokenOutput


class APIClientHTTPDriver:
    def __init__(self):
        self.base_url = os.getenv('API_BASE_URL', 'https://api.beddybytes.local').rstrip('/')
        # The local acceptance stack uses a self-signed certificate.
        tls_context = ssl._create_unverified_context()
        self.opener = build_opener(HTTPSHandler(context=tls_context))

    def get_token(self, email: str, password: str) -> TokenOutput:
        request = Request(
            f'{self.base_url}/token',
            data=urlencode({
                'grant_type': 'password',
                'username': email,
                'password': password,
            }).encode(),
            headers={'Content-Type': 'application/x-www-form-urlencoded'},
        )
        with self.opener.open(request, timeout=30) as response:
            return TokenOutput(access_token=json.load(response)['access_token'])

    def get_account_info(self, access_token: str) -> dict:
        return self._get('/accounts/current', access_token)

    def list_sessions(self, access_token: str):
        return self._get('/sessions', access_token)

    def _get(self, path: str, access_token: str):
        request = Request(
            f'{self.base_url}{path}',
            headers={'Authorization': f'Bearer {access_token}'},
        )
        with self.opener.open(request, timeout=30) as response:
            return json.load(response)


class APIClientHTTPDriverFactory:
    @contextmanager
    def create(self) -> Iterator[APIClientHTTPDriver]:
        client = APIClientHTTPDriver()
        try:
            yield client
        finally:
            client.opener.close()
