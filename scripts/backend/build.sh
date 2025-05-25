#!/bin/bash -ex

source scripts/backend/init.sh

case $1 in
    qa|prod)
        env=$1
        ;;
    *)
        echo "Usage: $0 <qa|prod>"
        exit 1
        ;;
esac

if [ "$env" = "prod" ]; then
    echo "Production builds are not supported yet."
    exit 1
fi

if [ -n "$2" ]; then
    branch=$2
else
    branch=$env
fi

aws codebuild start-build \
  --project-name $BUILD_PROJECT_NAME \
  --environment-variables-override name=DOCKER_IMAGE_TAG,value=$env,type=PLAINTEXT \
  --source-version $branch \
  --region $AWS_REGION