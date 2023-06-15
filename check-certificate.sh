#!/bin/bash
set -ex

# Check if a URL is provided as an argument
if [[ $# -eq 0 ]]; then
    echo "Please provide a URL as an argument."
    exit 1
fi

# Extract the common name from the SSL certificate
cn=$(echo | openssl s_client -connect $1 -servername $1 2>/dev/null | openssl x509 -noout -subject | awk -F= '/^subject/{print $NF}')

# Print the common name
echo "Common Name (CN): $cn"
