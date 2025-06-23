#!/bin/bash
. cloudformation/frontend/init.sh
set -ex

case $1 in
    qa|prod)
        env=$1
        ;;
    *)
        echo "Usage: $0 <qa|prod>"
        exit 1
        ;;
esac

. scripts/frontend/init.$env.sh

if [ -z "$DISTRIBUTION_ID" ]; then
    echo "DISTRIBUTION_ID is not set"
    exit 1
fi

region=us-east-1
bucket="beddybytes-$env-frontend-bucket"

# Cache-Control
# - static files: immutable
# - index.html: don't cache
# - everything else: cache for 1 day

# the service worker does network then cache for .html files
# cache then network for everything else

aws s3 sync --region $region --delete \
    --cache-control "max-age=31536000, immutable" \
    "frontend/build/static" "s3://$bucket/static"

aws s3 sync --region $region --delete \
    --cache-control "max-age=86400" \
    --exclude "static/*" \
    --exclude "index.html" \
    "frontend/build" "s3://$bucket/"

aws s3 cp --region $region \
    --cache-control "no-cache" \
    "frontend/build/index.html" "s3://$bucket/index.html"

aws cloudfront create-invalidation --region $region --distribution-id $DISTRIBUTION_ID --paths "/*"