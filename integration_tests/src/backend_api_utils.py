import datetime
import json
import os
import ssl
import subprocess
import sys
from urllib.parse import urlencode

import requests
import trio
from trio_websocket import open_websocket_url
import urllib3

from settings import api_base_url, api_websocket_base_url

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


class BackendAPIClient:
    def __init__(self):
        self.session = requests.Session()
        self.session.verify = False
        self.remote_address = "127.0.0.1"

    def create_account(self, email, password):
        anonymous_token = self.get_anonymous_token("iam:CreateAccount")
        response = self.session.post(
            f"{api_base_url}/accounts",
            headers=self._authorization_headers(anonymous_token),
            json={
                "email": email,
                "password": password,
            },
        )
        response.raise_for_status()
        return response.json()

    def get_anonymous_token(self, scope):
        response = self.session.post(
            f"{api_base_url}/anonymous_token",
            headers={
                "X-Forwarded-For": self.remote_address,
            },
            data={
                "scope": scope,
            },
        )
        response.raise_for_status()
        return response.json()["access_token"]

    def login(self, email, password):
        response = self.session.post(
            f"{api_base_url}/token",
            data={
                "grant_type": "password",
                "username": email,
                "password": password,
            },
        )
        response.raise_for_status()
        return response.json()["access_token"]

    def start_session(self, access_token, session_id, payload):
        return self.session.put(
            f"{api_base_url}/sessions/{session_id}",
            headers=self._authorization_headers(access_token),
            json=payload,
        )

    def end_session(self, access_token, session_id):
        return self.session.delete(
            f"{api_base_url}/sessions/{session_id}",
            headers=self._authorization_headers(access_token),
        )

    def list_sessions(self, access_token):
        response = self.session.get(
            f"{api_base_url}/sessions",
            headers=self._authorization_headers(access_token),
        )
        response.raise_for_status()
        return response.json()

    def wait_for_event(self, access_token, predicate, from_cursor=0, timeout_seconds=5):
        for event in self.iter_events(access_token, from_cursor=from_cursor, timeout_seconds=timeout_seconds):
            if predicate(event):
                return event
        raise AssertionError("event stream ended before matching event was received")

    def wait_for_events(self, access_token, count, from_cursor=0, timeout_seconds=5):
        events = []
        for event in self.iter_events(access_token, from_cursor=from_cursor, timeout_seconds=timeout_seconds):
            events.append(event)
            if len(events) == count:
                return events
        raise AssertionError(f"event stream ended before {count} events were received")

    def wait_for_matching_events(self, access_token, count, predicate, from_cursor=0, timeout_seconds=5):
        events = []
        for event in self.iter_events(access_token, from_cursor=from_cursor, timeout_seconds=timeout_seconds):
            if not predicate(event):
                continue
            events.append(event)
            if len(events) == count:
                return events
        raise AssertionError(f"event stream ended before {count} matching events were received")

    def iter_events(self, access_token, from_cursor=0, timeout_seconds=5):
        with self.session.get(
            f"{api_base_url}/events",
            params={
                "from_cursor": from_cursor,
                "access_token": access_token,
            },
            stream=True,
            timeout=(5, timeout_seconds),
        ) as response:
            response.raise_for_status()
            event_data_lines = []
            for raw_line in response.iter_lines(decode_unicode=True):
                if raw_line is None:
                    continue
                line = raw_line.strip()
                if line == "":
                    if not event_data_lines:
                        continue
                    event = json.loads("".join(event_data_lines))
                    event_data_lines = []
                    yield event
                    continue
                if line.startswith(":"):
                    continue
                if line.startswith("data: "):
                    event_data_lines.append(line[len("data: "):])
                    continue

    def _authorization_headers(self, access_token):
        return {
            "Authorization": f"Bearer {access_token}",
            "X-Forwarded-For": self.remote_address,
        }


def utc_now_seconds_rfc3339():
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def websocket_ssl_context():
    if not api_websocket_base_url.startswith("wss://"):
        return None
    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE
    return ssl_context


async def open_connection_websocket(access_token, client_id, connection_id, duration_seconds=1.0):
    query = urlencode({
        "access_token": access_token,
    })
    websocket_url = f"{api_websocket_base_url}/clients/{client_id}/connections/{connection_id}?{query}"
    async with open_websocket_url(websocket_url, ssl_context=websocket_ssl_context()):
        await trio.sleep(duration_seconds)


async def send_signal_between_connections(
    access_token,
    sender_client_id,
    sender_connection_id,
    recipient_client_id,
    recipient_connection_id,
    signal_data,
):
    def connection_websocket_url(client_id, connection_id):
        query = urlencode({
            "access_token": access_token,
        })
        return f"{api_websocket_base_url}/clients/{client_id}/connections/{connection_id}?{query}"

    async with open_websocket_url(
        connection_websocket_url(recipient_client_id, recipient_connection_id),
        ssl_context=websocket_ssl_context(),
    ) as recipient_websocket:
        async with open_websocket_url(
            connection_websocket_url(sender_client_id, sender_connection_id),
            ssl_context=websocket_ssl_context(),
        ) as sender_websocket:
            await trio.sleep(0.6)
            await sender_websocket.send_message(json.dumps({
                "type": "signal",
                "signal": {
                    "to_connection_id": recipient_connection_id,
                    "data": signal_data,
                },
            }))
            message = await recipient_websocket.get_message()
            if isinstance(message, bytes):
                message = message.decode("utf-8")
            return json.loads(message)


async def send_signal_over_connection(
    access_token,
    sender_client_id,
    sender_connection_id,
    recipient_connection_id,
    signal_data,
):
    def connection_websocket_url(client_id, connection_id):
        query = urlencode({
            "access_token": access_token,
        })
        return f"{api_websocket_base_url}/clients/{client_id}/connections/{connection_id}?{query}"

    async with open_websocket_url(
        connection_websocket_url(sender_client_id, sender_connection_id),
        ssl_context=websocket_ssl_context(),
    ) as sender_websocket:
        await trio.sleep(0.6)
        await sender_websocket.send_message(json.dumps({
            "type": "signal",
            "signal": {
                "to_connection_id": recipient_connection_id,
                "data": signal_data,
            },
        }))
        await trio.sleep(0.2)


async def receive_signal_over_connection(access_token, client_id, connection_id, ready_event, result_channel):
    def connection_websocket_url(client_id, connection_id):
        query = urlencode({
            "access_token": access_token,
        })
        return f"{api_websocket_base_url}/clients/{client_id}/connections/{connection_id}?{query}"

    async with open_websocket_url(
        connection_websocket_url(client_id, connection_id),
        ssl_context=websocket_ssl_context(),
    ) as websocket:
        ready_event.set()
        message = await websocket.get_message()
        if isinstance(message, bytes):
            message = message.decode("utf-8")
        await result_channel.send(json.loads(message))


async def send_signal_to_missing_connection_and_expect_pong(
    access_token,
    sender_client_id,
    sender_connection_id,
    missing_connection_id,
    signal_data,
):
    def connection_websocket_url(client_id, connection_id):
        query = urlencode({
            "access_token": access_token,
        })
        return f"{api_websocket_base_url}/clients/{client_id}/connections/{connection_id}?{query}"

    async with open_websocket_url(
        connection_websocket_url(sender_client_id, sender_connection_id),
        ssl_context=websocket_ssl_context(),
    ) as sender_websocket:
        await trio.sleep(0.6)
        await sender_websocket.send_message(json.dumps({
            "type": "signal",
            "signal": {
                "to_connection_id": missing_connection_id,
                "data": signal_data,
            },
        }))
        await sender_websocket.send_message(json.dumps({
            "type": "ping",
        }))
        message = await sender_websocket.get_message()
        if isinstance(message, bytes):
            message = message.decode("utf-8")
        return json.loads(message)


async def open_connection_websocket_until_signaled(access_token, client_id, connection_id, ready_event, release_event):
    query = urlencode({
        "access_token": access_token,
    })
    websocket_url = f"{api_websocket_base_url}/clients/{client_id}/connections/{connection_id}?{query}"
    async with open_websocket_url(websocket_url, ssl_context=websocket_ssl_context()):
        ready_event.set()
        await release_event.wait()


def spawn_connection_websocket_process(access_token, client_id, connection_id):
    query = urlencode({
        "access_token": access_token,
    })
    websocket_url = f"{api_websocket_base_url}/clients/{client_id}/connections/{connection_id}?{query}"
    ssl_context = """
import ssl
ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE
""" if api_websocket_base_url.startswith("wss://") else "ssl_context = None"
    script = f"""
import trio
from trio_websocket import open_websocket_url
{ssl_context}

async def main():
    async with open_websocket_url({websocket_url!r}, ssl_context=ssl_context):
        await trio.sleep_forever()

trio.run(main)
"""
    env = os.environ.copy()
    pythonpath_parts = ["/tmp/bb-it-pydeps", "/home/ryan/workspace-2/repositories/beddybytes/integration_tests/src"]
    if env.get("PYTHONPATH"):
        pythonpath_parts.append(env["PYTHONPATH"])
    env["PYTHONPATH"] = ":".join(pythonpath_parts)
    return subprocess.Popen([sys.executable, "-c", script], env=env)
