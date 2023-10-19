#!/bin/bash
. cloudformation/frontend/init.sh
set -ex

aws s3 sync --region $AWS_REGION frontend/build s3://$BUCKET

aws cloudfront create-invalidation --region $AWS_REGION --distribution-id $DISTRIBUTION_ID --paths "/*"