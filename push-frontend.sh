#!/bin/bash
. frontend/init.sh
set -ex

region=us-east-1
frontend_bucket=baby-monitor-frontend-bucket

aws s3 sync --region $region frontend/build s3://$frontend_bucket
aws s3 cp --region $region cloudformation/frontend/config.json s3://$frontend_bucket/config.json

aws cloudfront create-invalidation --region $region --distribution-id E1Y52Q1V84RNKD --paths "/*"