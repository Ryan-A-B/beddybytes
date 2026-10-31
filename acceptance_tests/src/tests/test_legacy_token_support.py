import hashlib
import hmac
import base64
import json

from conftest import TestInput
from utils import generate_random_string

signing_secret = "passwordpasswordpasswordpassword"

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
        account_info = api_client.get_account_info(new_access_token)
        assert account_info['id'] == original_account_info['id']
        assert account_info['license']['type'] == 'trial'
        # Unlike the account route, this route requires the monitor scope.
        assert api_client.list_sessions(new_access_token) == api_client.list_sessions(access_token)
