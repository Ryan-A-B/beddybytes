#!/bin/bash -ex

source scripts/backend/init.sh

if [ -n "$1" ]; then
    branch=$1
else
    branch=master
fi

if [ "$branch" = "master" ]; then
    tag=latest
else
    tag=$branch
fi

aws codebuild start-build \
  --project-name $BUILD_PROJECT_NAME \
  --environment-variables-override name=DOCKER_IMAGE_TAG,value=$tag,type=PLAINTEXT \
  --source-version $branch \
  --region $AWS_REGION