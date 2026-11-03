import json
import os
import ssl
from datetime import datetime, timezone
from email.message import Message
from http import HTTPStatus
from io import BytesIO
from contextlib import contextmanager
from typing import Iterator
from urllib.error import HTTPError
from urllib.parse import quote, urlencode, urlsplit, urlunsplit
from urllib.request import HTTPRedirectHandler, HTTPSHandler, Request, build_opener
from uuid import uuid4

import trio
from trio_websocket import ConnectionRejected, open_websocket_url

from protocol.api_client import TokenOutput


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, new_url):
        return None


class APIClientHTTPDriver:
    def __init__(self):
        self.base_url = os.getenv('API_BASE_URL', 'https://api.beddybytes.local').rstrip('/')
        # The local acceptance stack uses a self-signed certificate.
        self.tls_context = ssl._create_unverified_context()
        self.opener = build_opener(HTTPSHandler(context=self.tls_context), NoRedirect())
        self.connection_id = str(uuid4())

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

    def start_payment(self, access_token: str) -> str:
        request = self._request('/payments/start', access_token, method='POST')
        try:
            with self.opener.open(request, timeout=30):
                raise AssertionError('Expected checkout to return a 303 redirect')
        except HTTPError as error:
            if error.code != 303:
                raise
            with error:
                checkout_url = error.headers.get('Location', '')
                if urlsplit(checkout_url).hostname != 'checkout.stripe.com':
                    raise AssertionError('Expected a Stripe Checkout redirect')
                return checkout_url

    def list_clients(self, access_token: str) -> list[dict]:
        return self._get('/clients', access_token)

    def open_websocket(self, access_token: str, client_id: str) -> None:
        path = f'/clients/{quote(client_id, safe="")}/websocket?{urlencode({"client_type": "camera"})}'
        self._open_websocket(path, access_token)

    def open_connection(self, access_token: str, client_id: str, connection_id: str) -> None:
        path = f'/clients/{quote(client_id, safe="")}/connections/{quote(connection_id, safe="")}'
        self._open_websocket(path, access_token)
        self.connection_id = connection_id

    def _open_websocket(self, path: str, access_token: str) -> None:
        parsed_url = urlsplit(self.base_url + path)
        websocket_url = urlunsplit(parsed_url._replace(scheme='wss' if parsed_url.scheme == 'https' else 'ws'))

        async def handshake():
            try:
                async with open_websocket_url(
                    websocket_url,
                    ssl_context=self.tls_context if parsed_url.scheme == 'https' else None,
                    extra_headers=[(b'Authorization', f'Bearer {access_token}'.encode())],
                    connect_timeout=30,
                    disconnect_timeout=5,
                ):
                    pass
            except ConnectionRejected as error:
                headers = Message()
                for name, value in error.headers:
                    headers[name.decode('latin-1')] = value.decode('latin-1')
                raise HTTPError(
                    self.base_url + path, error.status_code,
                    HTTPStatus(error.status_code).phrase, headers, BytesIO(error.body or b''),
                ) from None

        trio.run(handshake)

    def list_sessions(self, access_token: str):
        return self._get('/sessions', access_token)

    def start_session(self, access_token: str, session_id: str) -> None:
        payload = {
            'id': session_id,
            'name': 'Acceptance test session',
            'host_connection_id': self.connection_id,
            'started_at': datetime.now(timezone.utc).isoformat(),
        }
        request = self._request(f'/sessions/{quote(session_id, safe="")}', access_token, method='PUT')
        request.add_header('Content-Type', 'application/json')
        request.data = json.dumps(payload).encode()
        with self.opener.open(request, timeout=30):
            pass

    def end_session(self, access_token: str, session_id: str) -> None:
        request = self._request(f'/sessions/{quote(session_id, safe="")}', access_token, method='DELETE')
        with self.opener.open(request, timeout=30):
            pass

    def get_events(self, access_token: str) -> str:
        request = self._request('/events', access_token)
        request.add_header('Accept', 'text/event-stream')
        with self.opener.open(request, timeout=30) as response:
            if response.headers.get_content_type() != 'text/event-stream':
                raise AssertionError('Expected a server-sent event stream')
            # The API sends an immediate greeting frame. Do not read to EOF:
            # the authenticated event stream remains open indefinitely.
            lines = []
            for _ in range(100):
                line = response.readline(65536)
                if not line:
                    raise AssertionError('Event stream closed before its first frame')
                lines.append(line.decode())
                if line in (b'\n', b'\r\n'):
                    return ''.join(lines)
            raise AssertionError('Event stream did not send a bounded first frame')

    def get_snapshot(self, access_token: str):
        return self._get('/baby_station_list_snapshot', access_token)

    def _request(self, path: str, access_token: str, method: str = 'GET') -> Request:
        return Request(
            f'{self.base_url}{path}',
            method=method,
            headers={'Authorization': f'Bearer {access_token}'},
        )

    def _get(self, path: str, access_token: str):
        request = self._request(path, access_token)
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
