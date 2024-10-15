#!/bin/bash
set -e

policies=(
    "default-src 'none'"
    "script-src 'self'"
    "connect-src 'self' api.beddybytes.com influx.beddybytes.com"
    "img-src 'self'"
    "style-src 'self'"
    "base-uri 'self'"
    "form-action 'self'"
)

content_security_policy=""
for policy in "${policies[@]}"; do
    content_security_policy="$content_security_policy$policy; "
done
echo $content_security_policy