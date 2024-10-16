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

aws s3 sync --region $region frontend/build s3://$bucket

aws cloudfront create-invalidation --region $region --distribution-id $DISTRIBUTION_ID --paths "/*"