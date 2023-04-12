import time
import hmac
import hashlib
import base64

secret = 'password'  # Replace with the static-auth-secret from your turnserver.conf
username = int(time.time()) + 24 * 3600  # Valid for 24 hours
uri = '10.64.227.111:5349'  # Replace with your TURN server address and port

password = hmac.new(secret.encode(), str(username).encode(), hashlib.sha1).digest()
password_base64 = base64.b64encode(password).decode()

print(f"Username: {username}")
print(f"Password: {password_base64}")
print(f"URI: {uri}")
