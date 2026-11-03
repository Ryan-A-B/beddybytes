import hashlib
import hmac
import base64
import json
import pytest
from urllib.error import HTTPError

from conftest import TestInput
from utils import generate_random_string

signing_secret = "passwordpasswordpasswordpassword"

actions = [
    lambda api_client, access_token: api_client.get_account_info(access_token),
    lambda api_client, access_token: api_client.start_payment(access_token),
    lambda api_client, access_token: api_client.list_clients(access_token),
    lambda api_client, access_token: api_client.open_websocket(access_token, 'client_foo'),
    lambda api_client, access_token: api_client.open_connection(access_token, 'client_foo', 'connection_bar'),
    lambda api_client, access_token: api_client.list_sessions(access_token),
    lambda api_client, access_token: api_client.start_session(access_token, 'session_baz'),
    lambda api_client, access_token: api_client.end_session(access_token, 'session_baz'),
    lambda api_client, access_token: api_client.get_events(access_token),
    lambda api_client, access_token: api_client.get_snapshot(access_token)
]

# legacy tokens use access tokens without the 'scp' claim
def test_access_token_works_with_no_scp(input: TestInput):
    with input.web_app_factory.create() as webapp, input.api_client_factory.create() as api_client:
        email = f'{generate_random_string(10)}@integrationtests.com'
        password = generate_random_string(20)
        webapp.create_account(email, password)
        get_token_output = api_client.get_token(email, password)
        access_token = get_token_output.access_token
        original_account_info = api_client.get_account_info(access_token)
        header, payload, signature = access_token.split('.')
        decoded_payload = base64.urlsafe_b64decode(payload + '==')
        decoded_payload_json = json.loads(decoded_payload)
        del decoded_payload_json['scp']
        new_payload = base64.urlsafe_b64encode(json.dumps(decoded_payload_json).encode()).decode().rstrip('=')
        signing_input = f'{header}.{new_payload}'
        signature = hmac.new(signing_secret.encode(), signing_input.encode(), hashlib.sha256).digest()
        encoded_signature = base64.urlsafe_b64encode(signature).decode().rstrip('=')
        new_access_token = f'{signing_input}.{encoded_signature}'
        for do_action in actions:
            do_action(api_client, new_access_token)

def test_access_denied_with_wrong_scp(input: TestInput):
    with input.web_app_factory.create() as webapp, input.api_client_factory.create() as api_client:
        email = f'{generate_random_string(10)}@integrationtests.com'
        password = generate_random_string(20)
        webapp.create_account(email, password)
        get_token_output = api_client.get_token(email, password)
        access_token = get_token_output.access_token
        original_account_info = api_client.get_account_info(access_token)
        header, payload, signature = access_token.split('.')
        decoded_payload = base64.urlsafe_b64decode(payload + '==')
        decoded_payload_json = json.loads(decoded_payload)
        decoded_payload_json['scp'] = 'wrong_scope'
        new_payload = base64.urlsafe_b64encode(json.dumps(decoded_payload_json).encode()).decode().rstrip('=')
        signing_input = f'{header}.{new_payload}'
        signature = hmac.new(signing_secret.encode(), signing_input.encode(), hashlib.sha256).digest()
        encoded_signature = base64.urlsafe_b64encode(signature).decode().rstrip('=')
        new_access_token = f'{signing_input}.{encoded_signature}'
        for do_action in actions:
            with pytest.raises(HTTPError) as exc_info:
                do_action(api_client, new_access_token)
            assert exc_info.value.code == 403
