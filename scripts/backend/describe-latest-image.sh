#!/bin/bash -ex

source scripts/backend/init.sh

aws ecr describe-images \
  --region "$AWS_REGION" \
  --repository-name beddybytes-api \
  --image-ids imageTag=latest \
  --query 'imageDetails[0].imageDigest' \
  --output text