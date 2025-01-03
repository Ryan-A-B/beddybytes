#!/bin/bash -ex

source scripts/backend/init.sh

docker build \
    --file scripts/backend/Dockerfile \
    --tag beddybytes-backend-api \
    .

docker tag beddybytes-backend-api $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/beddybytes-backend-api:latest