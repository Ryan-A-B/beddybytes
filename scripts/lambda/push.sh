#!/bin/bash
set -euo pipefail

if [ "${1:-}" != "" ]; then
    echo "Usage: $0"
    exit 1
fi

if [ -z "${AWS_REGION:-}" ]; then
    echo "AWS_REGION is not set"
    exit 1
fi

bucket="${BEDDYBYTES_CORE_BUCKET:-}"
if [ -z "$bucket" ]; then
    bucket="$(
        aws cloudformation list-exports \
            --region "$AWS_REGION" \
            --query "Exports[?Name=='beddybytes-core:bucket-name'].Value | [0]" \
            --output text
    )"
fi
if [ -z "$bucket" ] || [ "$bucket" = "None" ]; then
    echo "Could not resolve beddybytes-core bucket. Set BEDDYBYTES_CORE_BUCKET or deploy beddybytes-core with bucket output."
    exit 1
fi

zip_path="build/lambda/iot-authorizer.zip"
if [ ! -f "$zip_path" ]; then
    echo "$zip_path does not exist. Run scripts/lambda/build.sh first."
    exit 1
fi

zip_sha="$(sha256sum "$zip_path" | cut -d ' ' -f 1)"
key="lambda/iot-authorizer/$zip_sha.zip"

aws s3 cp --region "$AWS_REGION" "$zip_path" "s3://$bucket/$key"

echo "export BEDDYBYTES_CORE_BUCKET=$bucket"
echo "iot_authorizer_sha: '$zip_sha'"
