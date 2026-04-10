#!/bin/bash
set -ex

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

. $SCRIPT_DIR/init.sh

aws s3 sync --region $AWS_REGION marketing/public s3://$BUCKET

aws cloudfront create-invalidation --region $AWS_REGION --distribution-id $DISTRIBUTION_ID --paths "/*"