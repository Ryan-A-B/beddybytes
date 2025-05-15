#!/bin/bash
set -e

policies=(
    "default-src 'none'"
    "script-src 'self'"
    "connect-src 'self' https://*.beddybytes.com wss://*.beddybytes.com"
    "img-src 'self' data:"
    "style-src 'self'"
    "manifest-src 'self'"
    "base-uri 'self'"
    "form-action 'self'"
    "frame-src https://www.youtube.com/embed/uQHlMu7m5us"
)

content_security_policy=""
for policy in "${policies[@]}"; do
    content_security_policy="$content_security_policy$policy; "
done
echo $content_security_policy