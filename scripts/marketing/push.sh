#!/bin/bash
set -ex

ROOT_DIR=$(pwd)
SCRIPT_DIR=$(pwd)/scripts/marketing

. $SCRIPT_DIR/init.sh

aws s3 sync --region $AWS_REGION marketing/public s3://$BUCKET

aws cloudfront create-invalidation --region $AWS_REGION --distribution-id $DISTRIBUTION_ID --paths "/*"