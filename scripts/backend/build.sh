#!/bin/bash -ex

source scripts/backend/init.sh

docker build \
    --file scripts/backend/Dockerfile \
    --tag beddybytes-backend \
    .

docker tag beddybytes-backend $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/beddybytes-backend:latest