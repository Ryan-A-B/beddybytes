#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

encrypted_env="${BEDDYBYTES_MARKETING_SOPS_ENV_FILE:-config/marketing.sops.env}"

if ! command -v sops >/dev/null 2>&1; then
    echo "sops is required to deploy the marketing site." >&2
    exit 1
fi

if ! command -v aws >/dev/null 2>&1; then
    echo "The AWS CLI is required to deploy the marketing site." >&2
    exit 1
fi

if [[ ! -f "$encrypted_env" ]]; then
    echo "$encrypted_env is missing." >&2
    echo "Create it from config/marketing.env.example and encrypt it with SOPS." >&2
    exit 1
fi

sops exec-env --same-process "$encrypted_env" '
    set -eu
    : "${AWS_REGION:?AWS_REGION is missing from the marketing SOPS file}"
    : "${BUCKET:?BUCKET is missing from the marketing SOPS file}"
    : "${DISTRIBUTION_ID:?DISTRIBUTION_ID is missing from the marketing SOPS file}"

    aws s3 sync --region "$AWS_REGION" marketing/public "s3://$BUCKET"
    aws cloudfront create-invalidation \
        --region "$AWS_REGION" \
        --distribution-id "$DISTRIBUTION_ID" \
        --paths "/*"
'
