#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

case ${1:-} in
    qa|prod)
        deploy_env=$1
        ;;
    *)
        echo "Usage: $0 <qa|prod>" >&2
        exit 1
        ;;
esac

encrypted_env="${BEDDYBYTES_FRONTEND_SOPS_ENV_FILE:-config/frontend.${deploy_env}.sops.env}"

export FRONTEND_AWS_REGION=us-east-1
export FRONTEND_BUCKET="beddybytes-${deploy_env}-frontend-bucket"

# Cache-Control
# - static files: immutable
# - index.html: don't cache
# - everything else: cache for 1 day

# the service worker does network then cache for .html files
# cache then network for everything else

sops exec-env --same-process "$encrypted_env" '
    set -eu
    : "${DISTRIBUTION_ID:?DISTRIBUTION_ID is missing from the frontend SOPS file}"

    aws s3 sync --region "$FRONTEND_AWS_REGION" --delete \
        --cache-control "max-age=31536000, immutable" \
        frontend/build/static "s3://$FRONTEND_BUCKET/static"

    aws s3 sync --region "$FRONTEND_AWS_REGION" --delete \
        --cache-control "max-age=86400" \
        --exclude "static/*" \
        --exclude "index.html" \
        frontend/build "s3://$FRONTEND_BUCKET/"

    aws s3 cp --region "$FRONTEND_AWS_REGION" \
        --cache-control "no-cache" \
        frontend/build/index.html "s3://$FRONTEND_BUCKET/index.html"

    aws cloudfront create-invalidation \
        --region "$FRONTEND_AWS_REGION" \
        --distribution-id "$DISTRIBUTION_ID" \
        --paths "/*"
'
